#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec, Symbol, symbol_short, map, xdr::ToXdr, token, Token};

// Contract type definitions for yield farming
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FarmStatus {
    Inactive = 0,
    Active = 1,
    Paused = 2,
    Ended = 3,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct YieldFarm {
    pub farm_id: u64,
    pub reward_token: Address,
    pub staking_token: Address,
    pub total_staked: u64,
    pub reward_rate: u64, // Rewards per second
    pub reward_per_token_stored: u64,
    pub last_update_time: u64,
    pub period_finish: u64,
    pub status: FarmStatus,
    pub created_at: u64,
    pub name: String,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct UserStake {
    pub stake_id: u64,
    pub user: Address,
    pub farm_id: u64,
    pub amount: u64,
    pub reward_debt: u64,
    pub created_at: u64,
    pub last_claimed: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct RewardEvent {
    pub user: Address,
    pub farm_id: u64,
    pub amount: u64,
    pub timestamp: u64,
}

// Storage keys
const FARM_COUNTER: Symbol = symbol_short!("F_CNT");
const STAKE_COUNTER: Symbol = symbol_short!("S_CNT");
const FARMS: Symbol = symbol_short!("FARMS");
const STAKES: Symbol = symbol_short!("STAKES");
const USER_STAKES: Symbol = symbol_short!("U_STK");
const REWARD_EVENTS: Symbol = symbol_short!("REV_EV");
const ADMIN: Symbol = symbol_short!("ADMIN");
const INITIALIZED: Symbol = symbol_short!("INIT");

// Constants
const PRECISION: u64 = 1_000_000_000_000_000_000; // 18 decimals for calculations
const MAX_FARM_DURATION: u64 = 365 * 24 * 60 * 60; // 1 year in seconds

#[contract]
pub struct YieldFarmingContract;

#[contractimpl]
impl YieldFarmingContract {
    /// Initialize the contract with admin address
    pub fn initialize(env: &Env, admin: Address) {
        if env.storage().instance().get(&INITIALIZED).unwrap_or(false) {
            panic!("Contract already initialized");
        }
        
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&INITIALIZED, &true);
        env.storage().instance().set(&FARM_COUNTER, &0u64);
        env.storage().instance().set(&STAKE_COUNTER, &0u64);
    }

    /// Create a new yield farm
    pub fn create_farm(
        env: &Env,
        reward_token: Address,
        staking_token: Address,
        reward_rate: u64,
        duration: u64,
        name: String,
    ) -> u64 {
        // Validate inputs
        if reward_token == staking_token {
            panic!("Reward and staking tokens must be different");
        }
        
        if reward_rate == 0 {
            panic!("Reward rate must be greater than zero");
        }
        
        if duration == 0 || duration > MAX_FARM_DURATION {
            panic!("Invalid duration");
        }

        // Get new farm ID
        let farm_id: u64 = env.storage().instance().get(&FARM_COUNTER).unwrap_or(0) + 1;
        env.storage().instance().set(&FARM_COUNTER, &farm_id);

        let current_time = env.ledger().timestamp();
        let period_finish = current_time + duration;

        // Create farm
        let farm = YieldFarm {
            farm_id,
            reward_token: reward_token.clone(),
            staking_token: staking_token.clone(),
            total_staked: 0,
            reward_rate,
            reward_per_token_stored: 0,
            last_update_time: current_time,
            period_finish,
            status: FarmStatus::Active,
            created_at: current_time,
            name,
        };

        // Store farm
        env.storage().instance().set(&farm_id, &farm);

        farm_id
    }

    /// Stake tokens in a farm
    pub fn stake(env: &Env, user: Address, farm_id: u64, amount: u64) {
        if amount == 0 {
            panic!("Amount must be greater than zero");
        }

        let mut farm: YieldFarm = env.storage().instance().get(&farm_id)
            .unwrap_or_else(|| panic!("Farm does not exist"));

        if farm.status != FarmStatus::Active {
            panic!("Farm is not active");
        }

        // Update farm rewards
        self::update_reward(env, farm_id, &mut farm);

        // Transfer staking tokens from user to contract
        let staking_token_client = token::Client::new(env, &farm.staking_token);
        staking_token_client.transfer(&user, &env.current_contract_address(), &amount);

        // Update farm
        farm.total_staked += amount;
        env.storage().instance().set(&farm_id, &farm);

        // Update or create user stake
        self::update_user_stake(env, user.clone(), farm_id, amount, farm.reward_per_token_stored);
    }

    /// Unstake tokens from a farm
    pub fn unstake(env: &Env, user: Address, farm_id: u64, amount: u64) {
        if amount == 0 {
            panic!("Amount must be greater than zero");
        }

        let mut farm: YieldFarm = env.storage().instance().get(&farm_id)
            .unwrap_or_else(|| panic!("Farm does not exist"));

        // Update farm rewards
        self::update_reward(env, farm_id, &mut farm);

        // Get user stake
        let stake_key = (user.clone(), farm_id);
        let mut stake: UserStake = env.storage().instance().get(&stake_key)
            .unwrap_or_else(|| panic!("No stake found"));

        if stake.amount < amount {
            panic!("Insufficient staked amount");
        }

        // Calculate rewards
        let pending_rewards = self::calculate_pending_rewards(&stake, farm.reward_per_token_stored);

        // Update stake
        stake.amount -= amount;
        stake.reward_debt = (farm.reward_per_token_stored * stake.amount) / PRECISION;
        stake.last_claimed = env.ledger().timestamp();

        // Update farm
        farm.total_staked -= amount;
        env.storage().instance().set(&farm_id, &farm);

        // Transfer staking tokens back to user
        let staking_token_client = token::Client::new(env, &farm.staking_token);
        staking_token_client.transfer(&env.current_contract_address(), &user, &amount);

        // Transfer rewards if any
        if pending_rewards > 0 {
            let reward_token_client = token::Client::new(env, &farm.reward_token);
            reward_token_client.transfer(&env.current_contract_address(), &user, &pending_rewards);

            // Record reward event
            self::record_reward_event(env, user.clone(), farm_id, pending_rewards);
        }

        // Update or remove stake
        if stake.amount == 0 {
            env.storage().instance().remove(&stake_key);
            env.storage().instance().remove(&stake.stake_id);
        } else {
            env.storage().instance().set(&stake_key, &stake);
        }
    }

    /// Claim rewards without unstaking
    pub fn claim_rewards(env: &Env, user: Address, farm_id: u64) {
        let mut farm: YieldFarm = env.storage().instance().get(&farm_id)
            .unwrap_or_else(|| panic!("Farm does not exist"));

        // Update farm rewards
        self::update_reward(env, farm_id, &mut farm);

        // Get user stake
        let stake_key = (user.clone(), farm_id);
        let mut stake: UserStake = env.storage().instance().get(&stake_key)
            .unwrap_or_else(|| panic!("No stake found"));

        // Calculate rewards
        let pending_rewards = self::calculate_pending_rewards(&stake, farm.reward_per_token_stored);

        if pending_rewards == 0 {
            panic!("No rewards to claim");
        }

        // Update reward debt
        stake.reward_debt = (farm.reward_per_token_stored * stake.amount) / PRECISION;
        stake.last_claimed = env.ledger().timestamp();

        // Transfer rewards
        let reward_token_client = token::Client::new(env, &farm.reward_token);
        reward_token_client.transfer(&env.current_contract_address(), &user, &pending_rewards);

        // Record reward event
        self::record_reward_event(env, user.clone(), farm_id, pending_rewards);

        // Update stake
        env.storage().instance().set(&stake_key, &stake);
    }

    /// Get pending rewards for a user
    pub fn get_pending_rewards(env: &Env, user: Address, farm_id: u64) -> u64 {
        let farm: YieldFarm = env.storage().instance().get(&farm_id)
            .unwrap_or_else(|| panic!("Farm does not exist"));

        let stake_key = (user.clone(), farm_id);
        let stake: UserStake = env.storage().instance().get(&stake_key)
            .unwrap_or_else(|| panic!("No stake found"));

        // Update farm rewards for accurate calculation
        let mut farm_copy = farm.clone();
        self::update_reward(env, farm_id, &mut farm_copy);

        self::calculate_pending_rewards(&stake, farm_copy.reward_per_token_stored)
    }

    /// Get farm information
    pub fn get_farm(env: &Env, farm_id: u64) -> YieldFarm {
        let mut farm: YieldFarm = env.storage().instance().get(&farm_id)
            .unwrap_or_else(|| panic!("Farm does not exist"));
        
        // Update rewards for current state
        self::update_reward(env, farm_id, &mut farm);
        
        farm
    }

    /// Get user stakes
    pub fn get_user_stakes(env: &Env, user: Address) -> Vec<UserStake> {
        let stakes_key = (user.clone(), Symbol::new(&env, "stakes"));
        let stake_ids: Vec<u64> = env.storage().instance().get(&stakes_key).unwrap_or(Vec::new(&env));
        
        let mut stakes = Vec::new(&env);
        for stake_id in stake_ids.iter() {
            if let Some(stake) = env.storage().instance().get(&stake_id) {
                stakes.push_back(stake);
            }
        }
        stakes
    }

    /// Admin functions
    pub fn pause_farm(env: &Env, admin: Address, farm_id: u64) {
        self::require_admin(env, admin.clone());
        
        let mut farm: YieldFarm = env.storage().instance().get(&farm_id)
            .unwrap_or_else(|| panic!("Farm does not exist"));
        
        farm.status = FarmStatus::Paused;
        env.storage().instance().set(&farm_id, &farm);
    }

    pub fn unpause_farm(env: &Env, admin: Address, farm_id: u64) {
        self::require_admin(env, admin.clone());
        
        let mut farm: YieldFarm = env.storage().instance().get(&farm_id)
            .unwrap_or_else(|| panic!("Farm does not exist"));
        
        farm.status = FarmStatus::Active;
        farm.last_update_time = env.ledger().timestamp();
        env.storage().instance().set(&farm_id, &farm);
    }

    pub fn end_farm(env: &Env, admin: Address, farm_id: u64) {
        self::require_admin(env, admin.clone());
        
        let mut farm: YieldFarm = env.storage().instance().get(&farm_id)
            .unwrap_or_else(|| panic!("Farm does not exist"));
        
        farm.status = FarmStatus::Ended;
        farm.period_finish = env.ledger().timestamp();
        env.storage().instance().set(&farm_id, &farm);
    }

    /// Update reward calculations for a farm
    fn update_reward(env: &Env, farm_id: u64, farm: &mut YieldFarm) {
        let current_time = env.ledger().timestamp();
        
        if current_time <= farm.last_update_time {
            return;
        }

        if farm.total_staked == 0 {
            farm.last_update_time = current_time;
            return;
        }

        let reward_period = if current_time < farm.period_finish {
            current_time - farm.last_update_time
        } else if farm.last_update_time < farm.period_finish {
            farm.period_finish - farm.last_update_time
        } else {
            0
        };

        if reward_period > 0 {
            let reward = reward_period * farm.reward_rate;
            farm.reward_per_token_stored += (reward * PRECISION) / farm.total_staked;
        }

        farm.last_update_time = current_time;
    }

    /// Calculate pending rewards for a user
    fn calculate_pending_rewards(stake: &UserStake, reward_per_token: u64) -> u64 {
        let user_reward_per_token = (reward_per_token * stake.amount) / PRECISION;
        if user_reward_per_token > stake.reward_debt {
            user_reward_per_token - stake.reward_debt
        } else {
            0
        }
    }

    /// Update or create user stake
    fn update_user_stake(env: &Env, user: Address, farm_id: u64, amount: u64, reward_per_token: u64) {
        let stake_key = (user.clone(), farm_id);
        
        if let Some(mut stake) = env.storage().instance().get::<_, UserStake>(&stake_key) {
            // Update existing stake
            stake.amount += amount;
            stake.reward_debt = (reward_per_token * stake.amount) / PRECISION;
            stake.last_claimed = env.ledger().timestamp();
            env.storage().instance().set(&stake_key, &stake);
        } else {
            // Create new stake
            let stake_id: u64 = env.storage().instance().get(&STAKE_COUNTER).unwrap_or(0) + 1;
            env.storage().instance().set(&STAKE_COUNTER, &stake_id);

            let stake = UserStake {
                stake_id,
                user: user.clone(),
                farm_id,
                amount,
                reward_debt: (reward_per_token * amount) / PRECISION,
                created_at: env.ledger().timestamp(),
                last_claimed: env.ledger().timestamp(),
            };

            env.storage().instance().set(&stake_id, &stake);
            env.storage().instance().set(&stake_key, &stake);

            // Add to user's stake list
            let stakes_key = (user.clone(), Symbol::new(&env, "stakes"));
            let mut stake_ids: Vec<u64> = env.storage().instance().get(&stakes_key).unwrap_or(Vec::new(&env));
            stake_ids.push_back(stake_id);
            env.storage().instance().set(&stakes_key, &stake_ids);
        }
    }

    /// Record reward event
    fn record_reward_event(env: &Env, user: Address, farm_id: u64, amount: u64) {
        let event_count: u64 = env.storage().instance().get(&REWARD_EVENTS).unwrap_or(0);
        env.storage().instance().set(&REWARD_EVENTS, &(event_count + 1));

        let event = RewardEvent {
            user: user.clone(),
            farm_id,
            amount,
            timestamp: env.ledger().timestamp(),
        };

        env.storage().instance().set(&(event_count, farm_id), &event);
    }

    /// Require admin authorization
    fn require_admin(env: &Env, caller: Address) {
        let admin: Address = env.storage().instance().get(&ADMIN)
            .unwrap_or_else(|| panic!("Admin not set"));
        
        if caller != admin {
            panic!("Unauthorized: Admin required");
        }
    }
}
