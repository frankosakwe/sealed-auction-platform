/**
 * Risk Assessment Algorithms for DeFi Protocol
 * Provides comprehensive risk analysis for liquidity pools and yield farms
 */

class RiskAssessmentEngine {
  constructor(database) {
    this.db = database;
    this.riskFactors = {
      liquidity: 0.4,
      volatility: 0.3,
      concentration: 0.2,
      smartContract: 0.1
    };
  }

  /**
   * Calculate comprehensive risk assessment for a liquidity pool
   */
  async assessPoolRisk(poolId) {
    try {
      const pool = this.db.getLiquidityPool(poolId);
      if (!pool) {
        throw new Error('Pool not found');
      }

      const assessments = {
        liquidity: await this.assessLiquidityRisk(pool),
        volatility: await this.assessVolatilityRisk(pool),
        concentration: await this.assessConcentrationRisk(pool),
        smartContract: await this.assessSmartContractRisk(pool)
      };

      // Calculate weighted risk score (0-10, higher is riskier)
      let totalScore = 0;
      let factors = {};

      for (const [type, assessment] of Object.entries(assessments)) {
        const weight = this.riskFactors[type];
        totalScore += assessment.score * weight;
        factors[type] = assessment.factors;
      }

      const riskLevel = this.getRiskLevel(totalScore);

      // Save assessment to database
      this.db.createRiskAssessment({
        poolId,
        assessmentType: 'comprehensive',
        riskScore: totalScore,
        riskLevel,
        factors
      });

      return {
        poolId,
        riskScore: totalScore,
        riskLevel,
        assessments,
        factors,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error assessing pool risk:', error);
      throw error;
    }
  }

  /**
   * Calculate comprehensive risk assessment for a yield farm
   */
  async assessFarmRisk(farmId) {
    try {
      const farm = this.db.getYieldFarm(farmId);
      if (!farm) {
        throw new Error('Farm not found');
      }

      const assessments = {
        liquidity: await this.assessFarmLiquidityRisk(farm),
        volatility: await this.assessFarmVolatilityRisk(farm),
        concentration: await this.assessFarmConcentrationRisk(farm),
        smartContract: await this.assessSmartContractRisk(farm)
      };

      // Calculate weighted risk score
      let totalScore = 0;
      let factors = {};

      for (const [type, assessment] of Object.entries(assessments)) {
        const weight = this.riskFactors[type];
        totalScore += assessment.score * weight;
        factors[type] = assessment.factors;
      }

      const riskLevel = this.getRiskLevel(totalScore);

      // Save assessment to database
      this.db.createRiskAssessment({
        farmId,
        assessmentType: 'comprehensive',
        riskScore: totalScore,
        riskLevel,
        factors
      });

      return {
        farmId,
        riskScore: totalScore,
        riskLevel,
        assessments,
        factors,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error assessing farm risk:', error);
      throw error;
    }
  }

  /**
   * Assess liquidity risk for a pool
   */
  async assessLiquidityRisk(pool) {
    const factors = {
      totalLiquidity: pool.reserve_a + pool.reserve_b,
      liquidityRatio: Math.min(pool.reserve_a, pool.reserve_b) / Math.max(pool.reserve_a, pool.reserve_b),
      lpTokenSupply: pool.lp_token_supply,
      utilizationRate: 0 // Would need historical data
    };

    let score = 0;

    // Low liquidity increases risk
    if (factors.totalLiquidity < 10000) score += 4;
    else if (factors.totalLiquidity < 100000) score += 2;
    else if (factors.totalLiquidity < 1000000) score += 1;

    // Imbalanced pools are riskier
    if (factors.liquidityRatio < 0.1) score += 3;
    else if (factors.liquidityRatio < 0.3) score += 2;
    else if (factors.liquidityRatio < 0.5) score += 1;

    // Low LP token supply can indicate concentration risk
    if (factors.lpTokenSupply < 1000) score += 2;
    else if (factors.lpTokenSupply < 10000) score += 1;

    return {
      score: Math.min(score, 10),
      factors
    };
  }

  /**
   * Assess volatility risk for a pool
   */
  async assessVolatilityRisk(pool) {
    const tokenAPrice = this.db.getTokenPrice(pool.token_a);
    const tokenBPrice = this.db.getTokenPrice(pool.token_b);

    const factors = {
      tokenAVolatility: tokenAPrice?.price_change_24h || 0,
      tokenBVolatility: tokenBPrice?.price_change_24h || 0,
      priceStability: this.calculatePriceStability(pool.token_a, pool.token_b)
    };

    let score = 0;

    // High price changes indicate volatility
    const maxVolatility = Math.max(Math.abs(factors.tokenAVolatility), Math.abs(factors.tokenBVolatility));
    if (maxVolatility > 20) score += 4;
    else if (maxVolatility > 10) score += 3;
    else if (maxVolatility > 5) score += 2;
    else if (maxVolatility > 2) score += 1;

    // Low price stability increases risk
    if (factors.priceStability < 0.5) score += 3;
    else if (factors.priceStability < 0.7) score += 2;
    else if (factors.priceStability < 0.9) score += 1;

    return {
      score: Math.min(score, 10),
      factors
    };
  }

  /**
   * Assess concentration risk for a pool
   */
  async assessConcentrationRisk(pool) {
    const positions = this.db.getUserLiquidityPositions(pool.pool_id);
    
    const factors = {
      totalPositions: positions.length,
      largestPosition: positions.length > 0 ? Math.max(...positions.map(p => p.lp_amount)) : 0,
      top3Positions: positions.length > 0 
        ? positions.sort((a, b) => b.lp_amount - a.lp_amount).slice(0, 3).reduce((sum, p) => sum + p.lp_amount, 0)
        : 0,
      giniCoefficient: this.calculateGiniCoefficient(positions.map(p => p.lp_amount))
    };

    let score = 0;

    // Few positions indicate concentration risk
    if (factors.totalPositions < 5) score += 4;
    else if (factors.totalPositions < 10) score += 3;
    else if (factors.totalPositions < 20) score += 2;
    else if (factors.totalPositions < 50) score += 1;

    // Large positions relative to total supply
    if (pool.lp_token_supply > 0) {
      const largestPositionRatio = factors.largestPosition / pool.lp_token_supply;
      if (largestPositionRatio > 0.5) score += 3;
      else if (largestPositionRatio > 0.3) score += 2;
      else if (largestPositionRatio > 0.1) score += 1;

      const top3Ratio = factors.top3Positions / pool.lp_token_supply;
      if (top3Ratio > 0.8) score += 3;
      else if (top3Ratio > 0.6) score += 2;
      else if (top3Ratio > 0.4) score += 1;
    }

    // High Gini coefficient indicates inequality
    if (factors.giniCoefficient > 0.8) score += 3;
    else if (factors.giniCoefficient > 0.6) score += 2;
    else if (factors.giniCoefficient > 0.4) score += 1;

    return {
      score: Math.min(score, 10),
      factors
    };
  }

  /**
   * Assess smart contract risk
   */
  async assessSmartContractRisk(pool) {
    const factors = {
      contractAge: this.calculateContractAge(pool.created_at),
      auditStatus: await this.checkAuditStatus(pool.contract_address),
      codeComplexity: await this.assessCodeComplexity(pool.contract_address),
      upgradeability: await this.checkUpgradeability(pool.contract_address)
    };

    let score = 0;

    // New contracts are riskier
    if (factors.contractAge < 30) score += 3;
    else if (factors.contractAge < 90) score += 2;
    else if (factors.contractAge < 180) score += 1;

    // Unaudited contracts are riskier
    if (!factors.auditStatus) score += 4;
    else if (factors.auditStatus === 'partial') score += 2;

    // Complex code is riskier
    if (factors.codeComplexity > 1000) score += 3;
    else if (factors.codeComplexity > 500) score += 2;
    else if (factors.codeComplexity > 200) score += 1;

    // Upgradeable contracts have additional risks
    if (factors.upgradeability) score += 2;

    return {
      score: Math.min(score, 10),
      factors
    };
  }

  /**
   * Assess farm-specific liquidity risk
   */
  async assessFarmLiquidityRisk(farm) {
    const factors = {
      totalStaked: farm.total_staked,
      stakingTokenPrice: this.db.getTokenPrice(farm.staking_token),
      rewardTokenPrice: this.db.getTokenPrice(farm.reward_token),
      rewardRate: farm.reward_rate
    };

    let score = 0;

    // Low total staked amount
    if (factors.totalStaked < 10000) score += 3;
    else if (factors.totalStaked < 100000) score += 2;
    else if (factors.totalStaked < 1000000) score += 1;

    // Low reward rate might indicate low participation
    if (factors.rewardRate === 0) score += 2;
    else if (factors.rewardRate < 0.01) score += 1;

    return {
      score: Math.min(score, 10),
      factors
    };
  }

  /**
   * Assess farm-specific volatility risk
   */
  async assessFarmVolatilityRisk(farm) {
    const stakingTokenPrice = this.db.getTokenPrice(farm.staking_token);
    const rewardTokenPrice = this.db.getTokenPrice(farm.reward_token);

    const factors = {
      stakingTokenVolatility: stakingTokenPrice?.price_change_24h || 0,
      rewardTokenVolatility: rewardTokenPrice?.price_change_24h || 0,
      aprVolatility: await this.calculateAPRVolatility(farm.farm_id)
    };

    let score = 0;

    const maxVolatility = Math.max(
      Math.abs(factors.stakingTokenVolatility),
      Math.abs(factors.rewardTokenVolatility)
    );

    if (maxVolatility > 20) score += 4;
    else if (maxVolatility > 10) score += 3;
    else if (maxVolatility > 5) score += 2;
    else if (maxVolatility > 2) score += 1;

    if (factors.aprVolatility > 50) score += 3;
    else if (factors.aprVolatility > 25) score += 2;
    else if (factors.aprVolatility > 10) score += 1;

    return {
      score: Math.min(score, 10),
      factors
    };
  }

  /**
   * Assess farm-specific concentration risk
   */
  async assessFarmConcentrationRisk(farm) {
    const stakes = this.db.getUserStakes().filter(s => s.farm_id === farm.farm_id);
    
    const factors = {
      totalStakers: stakes.length,
      largestStake: stakes.length > 0 ? Math.max(...stakes.map(s => s.amount)) : 0,
      top3Stakes: stakes.length > 0 
        ? stakes.sort((a, b) => b.amount - a.amount).slice(0, 3).reduce((sum, s) => sum + s.amount, 0)
        : 0,
      giniCoefficient: this.calculateGiniCoefficient(stakes.map(s => s.amount))
    };

    let score = 0;

    if (factors.totalStakers < 5) score += 4;
    else if (factors.totalStakers < 10) score += 3;
    else if (factors.totalStakers < 20) score += 2;
    else if (factors.totalStakers < 50) score += 1;

    if (farm.total_staked > 0) {
      const largestStakeRatio = factors.largestStake / farm.total_staked;
      if (largestStakeRatio > 0.5) score += 3;
      else if (largestStakeRatio > 0.3) score += 2;
      else if (largestStakeRatio > 0.1) score += 1;

      const top3Ratio = factors.top3Stakes / farm.total_staked;
      if (top3Ratio > 0.8) score += 3;
      else if (top3Ratio > 0.6) score += 2;
      else if (top3Ratio > 0.4) score += 1;
    }

    if (factors.giniCoefficient > 0.8) score += 3;
    else if (factors.giniCoefficient > 0.6) score += 2;
    else if (factors.giniCoefficient > 0.4) score += 1;

    return {
      score: Math.min(score, 10),
      factors
    };
  }

  /**
   * Get risk level from score
   */
  getRiskLevel(score) {
    if (score >= 8) return 'critical';
    if (score >= 6) return 'high';
    if (score >= 4) return 'medium';
    if (score >= 2) return 'low';
    return 'very_low';
  }

  /**
   * Calculate Gini coefficient for concentration analysis
   */
  calculateGiniCoefficient(values) {
    if (values.length === 0) return 0;
    
    const sorted = values.sort((a, b) => a - b);
    const n = sorted.length;
    let sum = 0;
    
    for (let i = 0; i < n; i++) {
      sum += (2 * (i + 1) - n - 1) * sorted[i];
    }
    
    const totalSum = sorted.reduce((a, b) => a + b, 0);
    return totalSum === 0 ? 0 : sum / (n * totalSum);
  }

  /**
   * Calculate contract age in days
   */
  calculateContractAge(createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  }

  /**
   * Check audit status (mock implementation)
   */
  async checkAuditStatus(contractAddress) {
    // In a real implementation, this would query audit databases
    // For now, return a mock status
    return contractAddress ? 'audited' : 'none';
  }

  /**
   * Assess code complexity (mock implementation)
   */
  async assessCodeComplexity(contractAddress) {
    // In a real implementation, this would analyze the contract code
    // For now, return a mock complexity score
    return contractAddress ? 500 : 0;
  }

  /**
   * Check if contract is upgradeable (mock implementation)
   */
  async checkUpgradeability(contractAddress) {
    // In a real implementation, this would check contract patterns
    // For now, return false
    return false;
  }

  /**
   * Calculate price stability between two tokens
   */
  calculatePriceStability(tokenA, tokenB) {
    const priceA = this.db.getTokenPrice(tokenA);
    const priceB = this.db.getTokenPrice(tokenB);
    
    if (!priceA || !priceB) return 0.5; // Default to medium stability
    
    // Calculate correlation based on price changes (simplified)
    const changeA = Math.abs(priceA.price_change_24h);
    const changeB = Math.abs(priceB.price_change_24h);
    const avgChange = (changeA + changeB) / 2;
    
    // Lower average change indicates higher stability
    return Math.max(0, 1 - (avgChange / 100));
  }

  /**
   * Calculate APR volatility (mock implementation)
   */
  async calculateAPRVolatility(farmId) {
    // In a real implementation, this would analyze historical APR data
    // For now, return a mock volatility percentage
    return 15; // 15% volatility
  }

  /**
   * Generate risk report for all pools and farms
   */
  async generateRiskReport() {
    const pools = this.db.getAllLiquidityPools();
    const farms = this.db.getAllYieldFarms();

    const poolRisks = [];
    const farmRisks = [];

    for (const pool of pools) {
      try {
        const risk = await this.assessPoolRisk(pool.pool_id);
        poolRisks.push(risk);
      } catch (error) {
        console.error(`Error assessing pool ${pool.pool_id}:`, error);
      }
    }

    for (const farm of farms) {
      try {
        const risk = await this.assessFarmRisk(farm.farm_id);
        farmRisks.push(risk);
      } catch (error) {
        console.error(`Error assessing farm ${farm.farm_id}:`, error);
      }
    }

    return {
      timestamp: new Date().toISOString(),
      totalPools: pools.length,
      totalFarms: farms.length,
      poolRisks,
      farmRisks,
      summary: this.generateRiskSummary(poolRisks, farmRisks)
    };
  }

  /**
   * Generate summary statistics for risk report
   */
  generateRiskSummary(poolRisks, farmRisks) {
    const allRisks = [...poolRisks, ...farmRisks];
    
    const riskLevels = {
      very_low: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    let totalScore = 0;

    for (const risk of allRisks) {
      riskLevels[risk.riskLevel]++;
      totalScore += risk.riskScore;
    }

    const avgScore = allRisks.length > 0 ? totalScore / allRisks.length : 0;

    return {
      averageRiskScore: avgScore,
      riskDistribution: riskLevels,
      highestRisk: allRisks.reduce((max, risk) => risk.riskScore > max ? risk.riskScore : max, 0),
      lowestRisk: allRisks.reduce((min, risk) => risk.riskScore < min ? risk.riskScore : min, 10)
    };
  }
}

module.exports = RiskAssessmentEngine;
