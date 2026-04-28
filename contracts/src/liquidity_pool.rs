#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec, Symbol, symbol_short, map, xdr::ToXdr, token, Token};

// Contract type definitions for liquidity pools
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PoolStatus {
    Inactive = 0,
    Active = 1,
    Paused = 2,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct LiquidityPool {
    pub pool_id: u64,
    pub token_a: Address,
    pub token_b: Address,
    pub reserve_a: u64,
    pub reserve_b: u64,
    pub lp_token_supply: u64,
    pub fee_rate: u32, // Fee rate in basis points (100 = 1%)
    pub status: PoolStatus,
    pub created_at: u64,
    pub last_interaction: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct LiquidityPosition {
    pub position_id: u64,
    pub user: Address,
    pub pool_id: u64,
    pub lp_amount: u64,
    pub token_a_amount: u64,
    pub token_b_amount: u64,
    pub created_at: u64,
    pub last_updated: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct SwapEvent {
    pub user: Address,
    pub pool_id: u64,
    pub token_in: Address,
    pub token_out: Address,
    pub amount_in: u64,
    pub amount_out: u64,
    pub fee: u64,
    pub timestamp: u64,
}

// Storage keys
const POOL_COUNTER: Symbol = symbol_short!("P_CNT");
const POSITION_COUNTER: Symbol = symbol_short!("POS_C");
const POOLS: Symbol = symbol_short!("POOLS");
const POSITIONS: Symbol = symbol_short!("POSIT");
const USER_POSITIONS: Symbol = symbol_short!("U_POS");
const SWAP_EVENTS: Symbol = symbol_short!("SWAPS");
const ADMIN: Symbol = symbol_short!("ADMIN");
const INITIALIZED: Symbol = symbol_short!("INIT");

// Constants
const MINIMUM_LIQUIDITY: u64 = 1000; // Minimum LP tokens to mint
const MAX_FEE_RATE: u32 = 1000; // Maximum 10% fee
const FEE_PRECISION: u64 = 10000; // For fee calculations

#[contract]
pub struct LiquidityPoolContract;

#[contractimpl]
impl LiquidityPoolContract {
    /// Initialize the contract with admin address
    pub fn initialize(env: &Env, admin: Address) {
        if env.storage().instance().get(&INITIALIZED).unwrap_or(false) {
            panic!("Contract already initialized");
        }
        
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&INITIALIZED, &true);
        env.storage().instance().set(&POOL_COUNTER, &0u64);
        env.storage().instance().set(&POSITION_COUNTER, &0u64);
    }

    /// Create a new liquidity pool
    pub fn create_pool(
        env: &Env,
        token_a: Address,
        token_b: Address,
        fee_rate: u32,
    ) -> u64 {
        // Validate inputs
        if token_a == token_b {
            panic!("Token addresses must be different");
        }
        
        if fee_rate > MAX_FEE_RATE {
            panic!("Fee rate too high");
        }

        // Check if pool already exists
        let pool_key = (token_a.clone(), token_b.clone());
        if env.storage().instance().has(&pool_key) {
            panic!("Pool already exists for this token pair");
        }

        // Get new pool ID
        let pool_id: u64 = env.storage().instance().get(&POOL_COUNTER).unwrap_or(0) + 1;
        env.storage().instance().set(&POOL_COUNTER, &pool_id);

        // Create pool
        let pool = LiquidityPool {
            pool_id,
            token_a: token_a.clone(),
            token_b: token_b.clone(),
            reserve_a: 0,
            reserve_b: 0,
            lp_token_supply: 0,
            fee_rate,
            status: PoolStatus::Active,
            created_at: env.ledger().timestamp(),
            last_interaction: env.ledger().timestamp(),
        };

        // Store pool
        env.storage().instance().set(&pool_id, &pool);
        env.storage().instance().set(&pool_key, &pool_id);

        pool_id
    }

    /// Add liquidity to a pool
    pub fn add_liquidity(
        env: &Env,
        user: Address,
        pool_id: u64,
        amount_a: u64,
        amount_b: u64,
        min_lp_amount: u64,
    ) -> u64 {
        let mut pool: LiquidityPool = env.storage().instance().get(&pool_id)
            .unwrap_or_else(|| panic!("Pool does not exist"));

        if pool.status != PoolStatus::Active {
            panic!("Pool is not active");
        }

        if amount_a == 0 || amount_b == 0 {
            panic!("Amounts must be greater than zero");
        }

        // Calculate optimal amount ratio if pool has liquidity
        let (optimal_a, optimal_b) = if pool.reserve_a == 0 && pool.reserve_b == 0 {
            // First liquidity provider - use amounts as provided
            (amount_a, amount_b)
        } else {
            // Calculate optimal amount based on current ratio
            let optimal_a = (amount_b * pool.reserve_a) / pool.reserve_b;
            let optimal_b = (amount_a * pool.reserve_b) / pool.reserve_a;
            
            // Use the smaller optimal amount to maintain ratio
            if optimal_a <= amount_a {
                (optimal_a, amount_b)
            } else {
                (amount_a, optimal_b)
            }
        };

        // Calculate LP tokens to mint
        let lp_amount = if pool.lp_token_supply == 0 {
            // First liquidity provider
            (optimal_a * optimal_b).sqrt()
        } else {
            // Subsequent providers
            std::cmp::min(
                (optimal_a * pool.lp_token_supply) / pool.reserve_a,
                (optimal_b * pool.lp_token_supply) / pool.reserve_b
            )
        };

        if lp_amount < min_lp_amount {
            panic!("LP amount below minimum");
        }

        if lp_amount < MINIMUM_LIQUIDITY {
            panic!("LP amount below minimum threshold");
        }

        // Transfer tokens from user to contract
        let token_a_client = token::Client::new(env, &pool.token_a);
        let token_b_client = token::Client::new(env, &pool.token_b);
        
        token_a_client.transfer(&user, &env.current_contract_address(), &optimal_a);
        token_b_client.transfer(&user, &env.current_contract_address(), &optimal_b);

        // Update pool reserves and LP supply
        pool.reserve_a += optimal_a;
        pool.reserve_b += optimal_b;
        pool.lp_token_supply += lp_amount;
        pool.last_interaction = env.ledger().timestamp();

        // Store updated pool
        env.storage().instance().set(&pool_id, &pool);

        // Create or update user position
        self::update_user_position(env, user.clone(), pool_id, lp_amount, optimal_a, optimal_b);

        lp_amount
    }

    /// Remove liquidity from a pool
    pub fn remove_liquidity(
        env: &Env,
        user: Address,
        pool_id: u64,
        lp_amount: u64,
        min_amount_a: u64,
        min_amount_b: u64,
    ) -> (u64, u64) {
        let mut pool: LiquidityPool = env.storage().instance().get(&pool_id)
            .unwrap_or_else(|| panic!("Pool does not exist"));

        if pool.status != PoolStatus::Active {
            panic!("Pool is not active");
        }

        if lp_amount == 0 {
            panic!("LP amount must be greater than zero");
        }

        // Calculate amounts to return
        let amount_a = (lp_amount * pool.reserve_a) / pool.lp_token_supply;
        let amount_b = (lp_amount * pool.reserve_b) / pool.lp_token_supply;

        if amount_a < min_amount_a || amount_b < min_amount_b {
            panic!("Amounts below minimum");
        }

        // Update user position
        self::decrease_user_position(env, user.clone(), pool_id, lp_amount);

        // Update pool
        pool.reserve_a -= amount_a;
        pool.reserve_b -= amount_b;
        pool.lp_token_supply -= lp_amount;
        pool.last_interaction = env.ledger().timestamp();

        env.storage().instance().set(&pool_id, &pool);

        // Transfer tokens back to user
        let token_a_client = token::Client::new(env, &pool.token_a);
        let token_b_client = token::Client::new(env, &pool.token_b);
        
        token_a_client.transfer(&env.current_contract_address(), &user, &amount_a);
        token_b_client.transfer(&env.current_contract_address(), &user, &amount_b);

        (amount_a, amount_b)
    }

    /// Swap tokens
    pub fn swap(
        env: &Env,
        user: Address,
        pool_id: u64,
        token_in: Address,
        amount_in: u64,
        min_amount_out: u64,
    ) -> u64 {
        let mut pool: LiquidityPool = env.storage().instance().get(&pool_id)
            .unwrap_or_else(|| panic!("Pool does not exist"));

        if pool.status != PoolStatus::Active {
            panic!("Pool is not active");
        }

        if amount_in == 0 {
            panic!("Amount in must be greater than zero");
        }

        // Determine which token is being swapped
        let (reserve_in, reserve_out, token_out) = if token_in == pool.token_a {
            (pool.reserve_a, pool.reserve_b, pool.token_b.clone())
        } else if token_in == pool.token_b {
            (pool.reserve_b, pool.reserve_a, pool.token_a.clone())
        } else {
            panic!("Invalid input token");
        };

        // Calculate amount out with fee
        let fee_amount = (amount_in * pool.fee_rate as u64) / FEE_PRECISION;
        let amount_in_after_fee = amount_in - fee_amount;
        let amount_out = (amount_in_after_fee * reserve_out) / (reserve_in + amount_in_after_fee);

        if amount_out < min_amount_out {
            panic!("Insufficient output amount");
        }

        // Update reserves
        if token_in == pool.token_a {
            pool.reserve_a += amount_in;
            pool.reserve_b -= amount_out;
        } else {
            pool.reserve_b += amount_in;
            pool.reserve_a -= amount_out;
        }
        pool.last_interaction = env.ledger().timestamp();

        env.storage().instance().set(&pool_id, &pool);

        // Transfer tokens
        let token_in_client = token::Client::new(env, &token_in);
        let token_out_client = token::Client::new(env, &token_out);
        
        token_in_client.transfer(&user, &env.current_contract_address(), &amount_in);
        token_out_client.transfer(&env.current_contract_address(), &user, &amount_out);

        // Record swap event
        let swap_event = SwapEvent {
            user: user.clone(),
            pool_id,
            token_in: token_in.clone(),
            token_out: token_out.clone(),
            amount_in,
            amount_out,
            fee: fee_amount,
            timestamp: env.ledger().timestamp(),
        };

        let event_count: u64 = env.storage().instance().get(&SWAP_EVENTS).unwrap_or(0);
        env.storage().instance().set(&SWAP_EVENTS, &(event_count + 1));
        env.storage().instance().set(&(event_count, pool_id), &swap_event);

        amount_out
    }

    /// Get pool information
    pub fn get_pool(env: &Env, pool_id: u64) -> LiquidityPool {
        env.storage().instance().get(&pool_id)
            .unwrap_or_else(|| panic!("Pool does not exist"))
    }

    /// Get user positions
    pub fn get_user_positions(env: &Env, user: Address) -> Vec<LiquidityPosition> {
        let positions_key = (user.clone(), Symbol::new(&env, "positions"));
        let position_ids: Vec<u64> = env.storage().instance().get(&positions_key).unwrap_or(Vec::new(&env));
        
        let mut positions = Vec::new(&env);
        for position_id in position_ids.iter() {
            if let Some(position) = env.storage().instance().get(&position_id) {
                positions.push_back(position);
            }
        }
        positions
    }

    /// Helper function to update user position
    fn update_user_position(
        env: &Env,
        user: Address,
        pool_id: u64,
        lp_amount: u64,
        token_a_amount: u64,
        token_b_amount: u64,
    ) {
        let position_key = (user.clone(), pool_id);
        
        if let Some(mut position) = env.storage().instance().get::<_, LiquidityPosition>(&position_key) {
            // Update existing position
            position.lp_amount += lp_amount;
            position.token_a_amount += token_a_amount;
            position.token_b_amount += token_b_amount;
            position.last_updated = env.ledger().timestamp();
            env.storage().instance().set(&position_key, &position);
        } else {
            // Create new position
            let position_id: u64 = env.storage().instance().get(&POSITION_COUNTER).unwrap_or(0) + 1;
            env.storage().instance().set(&POSITION_COUNTER, &position_id);

            let position = LiquidityPosition {
                position_id,
                user: user.clone(),
                pool_id,
                lp_amount,
                token_a_amount,
                token_b_amount,
                created_at: env.ledger().timestamp(),
                last_updated: env.ledger().timestamp(),
            };

            env.storage().instance().set(&position_id, &position);
            env.storage().instance().set(&position_key, &position);

            // Add to user's position list
            let positions_key = (user.clone(), Symbol::new(&env, "positions"));
            let mut position_ids: Vec<u64> = env.storage().instance().get(&positions_key).unwrap_or(Vec::new(&env));
            position_ids.push_back(position_id);
            env.storage().instance().set(&positions_key, &position_ids);
        }
    }

    /// Helper function to decrease user position
    fn decrease_user_position(
        env: &Env,
        user: Address,
        pool_id: u64,
        lp_amount: u64,
    ) {
        let position_key = (user.clone(), pool_id);
        let mut position: LiquidityPosition = env.storage().instance().get(&position_key)
            .unwrap_or_else(|| panic!("Position does not exist"));

        if position.lp_amount < lp_amount {
            panic!("Insufficient LP tokens");
        }

        // Calculate proportional token amounts to remove
        let token_a_remove = (lp_amount * position.token_a_amount) / position.lp_amount;
        let token_b_remove = (lp_amount * position.token_b_amount) / position.lp_amount;

        position.lp_amount -= lp_amount;
        position.token_a_amount -= token_a_remove;
        position.token_b_amount -= token_b_remove;
        position.last_updated = env.ledger().timestamp();

        if position.lp_amount == 0 {
            // Remove position entirely
            env.storage().instance().remove(&position_key);
            env.storage().instance().remove(&position.position_id);

            // Remove from user's position list
            let positions_key = (user.clone(), Symbol::new(&env, "positions"));
            let mut position_ids: Vec<u64> = env.storage().instance().get(&positions_key).unwrap_or(Vec::new(&env));
            position_ids.remove(position_ids.iter().position(|&id| id == position.position_id).unwrap());
            env.storage().instance().set(&positions_key, &position_ids);
        } else {
            env.storage().instance().set(&position_key, &position);
        }
    }

    /// Admin functions
    pub fn pause_pool(env: &Env, admin: Address, pool_id: u64) {
        self::require_admin(env, admin.clone());
        
        let mut pool: LiquidityPool = env.storage().instance().get(&pool_id)
            .unwrap_or_else(|| panic!("Pool does not exist"));
        
        pool.status = PoolStatus::Paused;
        env.storage().instance().set(&pool_id, &pool);
    }

    pub fn unpause_pool(env: &Env, admin: Address, pool_id: u64) {
        self::require_admin(env, admin.clone());
        
        let mut pool: LiquidityPool = env.storage().instance().get(&pool_id)
            .unwrap_or_else(|| panic!("Pool does not exist"));
        
        pool.status = PoolStatus::Active;
        env.storage().instance().set(&pool_id, &pool);
    }

    fn require_admin(env: &Env, caller: Address) {
        let admin: Address = env.storage().instance().get(&ADMIN)
            .unwrap_or_else(|| panic!("Admin not set"));
        
        if caller != admin {
            panic!("Unauthorized: Admin required");
        }
    }
}
