// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title SealedBidAuction
 * @dev A smart contract for sealed-bid auctions with commit-reveal scheme
 * @notice This contract implements a secure sealed-bid auction system
 */
contract SealedBidAuction is ReentrancyGuard, Ownable, Pausable {
    using Counters for Counters.Counter;
    
    Counters.Counter private _auctionIds;
    Counters.Counter private _bidIds;
    
    // Auction status enum
    enum AuctionStatus { Created, Active, Ended, Cancelled }
    
    // Bid status enum
    enum BidStatus { Committed, Revealed, Refunded }
    
    // Structs
    struct Auction {
        uint256 auctionId;
        address creator;
        string title;
        string description;
        uint256 startingBid;
        uint256 endTime;
        uint256 bidCount;
        address highestBidder;
        uint256 highestBid;
        AuctionStatus status;
        uint256 createdAt;
        uint256 endedAt;
    }
    
    struct Bid {
        uint256 bidId;
        uint256 auctionId;
        address bidder;
        bytes32 commitment; // Hash of (bidAmount, secret)
        uint256 bidAmount;
        bytes32 secret;
        BidStatus status;
        uint256 committedAt;
        uint256 revealedAt;
    }
    
    // Mappings
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => Bid) public bids;
    mapping(uint256 => mapping(address => bool)) public hasCommitted;
    mapping(uint256 => mapping(address => bool)) public hasRevealed;
    mapping(address => uint256[]) public userAuctions;
    mapping(address => uint256[]) public userBids;
    
    // Events
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed creator,
        string title,
        uint256 startingBid,
        uint256 endTime
    );
    
    event BidCommitted(
        uint256 indexed auctionId,
        uint256 indexed bidId,
        address indexed bidder,
        bytes32 commitment
    );
    
    event BidRevealed(
        uint256 indexed auctionId,
        uint256 indexed bidId,
        address indexed bidder,
        uint256 bidAmount
    );
    
    event AuctionEnded(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 winningBid
    );
    
    event AuctionCancelled(uint256 indexed auctionId);
    
    event BidRefunded(
        uint256 indexed auctionId,
        uint256 indexed bidId,
        address indexed bidder,
        uint256 amount
    );
    
    // Modifiers
    modifier onlyAuctionCreator(uint256 _auctionId) {
        require(auctions[_auctionId].creator == msg.sender, "Not auction creator");
        _;
    }
    
    modifier auctionExists(uint256 _auctionId) {
        require(_auctionId > 0 && _auctionId <= _auctionIds.current(), "Auction does not exist");
        _;
    }
    
    modifier auctionActive(uint256 _auctionId) {
        require(auctions[_auctionId].status == AuctionStatus.Active, "Auction not active");
        require(block.timestamp < auctions[_auctionId].endTime, "Auction ended");
        _;
    }
    
    modifier bidExists(uint256 _bidId) {
        require(_bidId > 0 && _bidId <= _bidIds.current(), "Bid does not exist");
        _;
    }
    
    constructor() {
        // Initialize contract
    }
    
    /**
     * @dev Create a new auction
     * @param _title Auction title
     * @param _description Auction description
     * @param _startingBid Starting bid amount
     * @param _duration Auction duration in seconds
     */
    function createAuction(
        string memory _title,
        string memory _description,
        uint256 _startingBid,
        uint256 _duration
    ) external whenNotPaused returns (uint256) {
        require(_startingBid > 0, "Starting bid must be greater than 0");
        require(_duration > 0, "Duration must be greater than 0");
        
        _auctionIds.increment();
        uint256 auctionId = _auctionIds.current();
        
        auctions[auctionId] = Auction({
            auctionId: auctionId,
            creator: msg.sender,
            title: _title,
            description: _description,
            startingBid: _startingBid,
            endTime: block.timestamp + _duration,
            bidCount: 0,
            highestBidder: address(0),
            highestBid: 0,
            status: AuctionStatus.Active,
            createdAt: block.timestamp,
            endedAt: 0
        });
        
        userAuctions[msg.sender].push(auctionId);
        
        emit AuctionCreated(auctionId, msg.sender, _title, _startingBid, block.timestamp + _duration);
        
        return auctionId;
    }
    
    /**
     * @dev Commit a sealed bid (commit-reveal scheme)
     * @param _auctionId Auction ID
     * @param _commitment Hash of (bidAmount, secret)
     */
    function commitBid(
        uint256 _auctionId,
        bytes32 _commitment
    ) external payable nonReentrant auctionExists(_auctionId) auctionActive(_auctionId) {
        require(!hasCommitted[_auctionId][msg.sender], "Already committed");
        require(msg.value >= auctions[_auctionId].startingBid, "Bid below starting amount");
        
        _bidIds.increment();
        uint256 bidId = _bidIds.current();
        
        bids[bidId] = Bid({
            bidId: bidId,
            auctionId: _auctionId,
            bidder: msg.sender,
            commitment: _commitment,
            bidAmount: 0,
            secret: bytes32(0),
            status: BidStatus.Committed,
            committedAt: block.timestamp,
            revealedAt: 0
        });
        
        hasCommitted[_auctionId][msg.sender] = true;
        auctions[_auctionId].bidCount++;
        userBids[msg.sender].push(bidId);
        
        emit BidCommitted(_auctionId, bidId, msg.sender, _commitment);
    }
    
    /**
     * @dev Reveal a committed bid
     * @param _bidId Bid ID
     * @param _bidAmount Actual bid amount
     * @param _secret Secret used for commitment
     */
    function revealBid(
        uint256 _bidId,
        uint256 _bidAmount,
        bytes32 _secret
    ) external nonReentrant bidExists(_bidId) {
        Bid storage bid = bids[_bidId];
        Auction storage auction = auctions[bid.auctionId];
        
        require(bid.bidder == msg.sender, "Not bid owner");
        require(bid.status == BidStatus.Committed, "Bid already revealed");
        require(block.timestamp < auction.endTime, "Reveal period ended");
        
        // Verify commitment
        bytes32 computedCommitment = keccak256(abi.encodePacked(_bidAmount, _secret));
        require(computedCommitment == bid.commitment, "Invalid commitment");
        
        // Update bid
        bid.bidAmount = _bidAmount;
        bid.secret = _secret;
        bid.status = BidStatus.Revealed;
        bid.revealedAt = block.timestamp;
        
        // Update highest bid if necessary
        if (_bidAmount > auction.highestBid) {
            auction.highestBid = _bidAmount;
            auction.highestBidder = msg.sender;
        }
        
        emit BidRevealed(bid.auctionId, _bidId, msg.sender, _bidAmount);
    }
    
    /**
     * @dev End an auction and determine winner
     * @param _auctionId Auction ID
     */
    function endAuction(uint256 _auctionId) external auctionExists(_auctionId) {
        Auction storage auction = auctions[_auctionId];
        
        require(auction.status == AuctionStatus.Active, "Auction not active");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        
        auction.status = AuctionStatus.Ended;
        auction.endedAt = block.timestamp;
        
        if (auction.highestBidder != address(0)) {
            emit AuctionEnded(_auctionId, auction.highestBidder, auction.highestBid);
        } else {
            emit AuctionEnded(_auctionId, address(0), 0);
        }
    }
    
    /**
     * @dev Cancel an auction (only creator)
     * @param _auctionId Auction ID
     */
    function cancelAuction(uint256 _auctionId) external onlyAuctionCreator(_auctionId) auctionExists(_auctionId) {
        Auction storage auction = auctions[_auctionId];
        
        require(auction.status == AuctionStatus.Active, "Auction not active");
        
        auction.status = AuctionStatus.Cancelled;
        auction.endedAt = block.timestamp;
        
        emit AuctionCancelled(_auctionId);
    }
    
    /**
     * @dev Refund bid to bidder (for non-winning bids)
     * @param _bidId Bid ID
     */
    function refundBid(uint256 _bidId) external nonReentrant bidExists(_bidId) {
        Bid storage bid = bids[_bidId];
        Auction storage auction = auctions[bid.auctionId];
        
        require(bid.bidder == msg.sender || auction.creator == msg.sender, "Not authorized");
        require(bid.status == BidStatus.Revealed, "Bid not revealed");
        require(auction.status == AuctionStatus.Ended, "Auction not ended");
        require(bid.bidder != auction.highestBidder, "Winning bid cannot be refunded");
        require(!hasRevealed[bid.auctionId][msg.sender], "Already refunded");
        
        hasRevealed[bid.auctionId][msg.sender] = true;
        
        uint256 refundAmount = bid.bidAmount;
        if (refundAmount > 0) {
            payable(msg.sender).transfer(refundAmount);
            emit BidRefunded(bid.auctionId, _bidId, msg.sender, refundAmount);
        }
    }
    
    /**
     * @dev Withdraw winnings (for auction creator)
     * @param _auctionId Auction ID
     */
    function withdrawWinnings(uint256 _auctionId) external nonReentrant auctionExists(_auctionId) {
        Auction storage auction = auctions[_auctionId];
        
        require(auction.creator == msg.sender, "Not auction creator");
        require(auction.status == AuctionStatus.Ended, "Auction not ended");
        require(auction.highestBidder != address(0), "No winner");
        
        uint256 winnings = auction.highestBid;
        if (winnings > 0) {
            auction.highestBid = 0; // Prevent multiple withdrawals
            payable(msg.sender).transfer(winnings);
        }
    }
    
    /**
     * @dev Get auction details
     * @param _auctionId Auction ID
     */
    function getAuction(uint256 _auctionId) external view auctionExists(_auctionId) returns (Auction memory) {
        return auctions[_auctionId];
    }
    
    /**
     * @dev Get bid details
     * @param _bidId Bid ID
     */
    function getBid(uint256 _bidId) external view bidExists(_bidId) returns (Bid memory) {
        return bids[_bidId];
    }
    
    /**
     * @dev Get user's auctions
     * @param _user User address
     */
    function getUserAuctions(address _user) external view returns (uint256[] memory) {
        return userAuctions[_user];
    }
    
    /**
     * @dev Get user's bids
     * @param _user User address
     */
    function getUserBids(address _user) external view returns (uint256[] memory) {
        return userBids[_user];
    }
    
    /**
     * @dev Get total number of auctions
     */
    function getTotalAuctions() external view returns (uint256) {
        return _auctionIds.current();
    }
    
    /**
     * @dev Get total number of bids
     */
    function getTotalBids() external view returns (uint256) {
        return _bidIds.current();
    }
    
    /**
     * @dev Pause contract (emergency only)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Get commitment hash for bid
     * @param _bidAmount Bid amount
     * @param _secret Secret
     */
    function getCommitment(uint256 _bidAmount, bytes32 _secret) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_bidAmount, _secret));
    }
}
