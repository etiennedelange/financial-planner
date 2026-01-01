class EnhancedRetirementCalculator
{
  static void Main()
  {
    // Base parameters in ZAR
    double currentSavings = 1700000;  // Current savings in ZAR
    int yearsToRetirement = 27;
    double currentMonthlyContribution = 25000;  // Monthly contribution in ZAR
    double contributionGrowthRate = 0.06; // Growth rate of contributions (based on salary increases)
    double inflation = 0.055; // South African inflation tends to be higher than developed markets
    double monthlyExpensesNow = 25000; // Monthly expenses in ZAR
    double safeWithdrawalRate = 0.03; // 4% rule (may need adjustment for SA conditions)

    // Additional parameters
    int desiredRetirementYears = 35;
    double socialSecurityMonthly = 0; // South Africa doesn't have Social Security, but you can add SASSA grant if applicable
    double pensionMonthly = 0; // Any expected pension in ZAR

    // Investment scenarios for South Africa (nominal returns)
    var scenarios = new List<(string name, double nominalReturn, double volatility)>
        {
            ("Conservative", 0.105, 0.10),  // Higher nominal returns due to higher inflation
            ("Balanced", 0.12, 0.14),      // Typical balanced fund in SA
            ("Aggressive", 0.14, 0.18)     // Equity heavy portfolio in SA
        };

    // Target monthly contribution calculation
    FindOptimalContribution(
        currentSavings,
        yearsToRetirement,
        contributionGrowthRate,
        inflation,
        monthlyExpensesNow,
        desiredRetirementYears,
        socialSecurityMonthly,
        pensionMonthly,
        scenarios,
        safeWithdrawalRate
    );

    // Run detailed simulation with the suggested contribution
    RunDetailedSimulation(
        currentSavings,
        yearsToRetirement,
        currentMonthlyContribution, // Using current contribution for comparison
        contributionGrowthRate,
        inflation,
        monthlyExpensesNow,
        desiredRetirementYears,
        socialSecurityMonthly,
        pensionMonthly,
        scenarios,
        safeWithdrawalRate
    );
  }

  static void FindOptimalContribution(
      double currentSavings,
      int yearsToRetirement,
      double contributionGrowthRate,
      double inflation,
      double monthlyExpensesNow,
      int desiredRetirementYears,
      double socialSecurityMonthly,
      double pensionMonthly,
      List<(string name, double nominalReturn, double volatility)> scenarios,
      double safeWithdrawalRate)
  {
    Console.WriteLine("=== CALCULATING OPTIMAL MONTHLY CONTRIBUTION ===\n");

    // Calculate annual expenses in retirement (adjusted for inflation)
    double annualExpensesAtRetirement = monthlyExpensesNow * 12 * Math.Pow(1 + inflation, yearsToRetirement);
    double annualOtherIncomeAtRetirement = (socialSecurityMonthly + pensionMonthly) * 12 * Math.Pow(1 + inflation, yearsToRetirement);
    double netAnnualExpensesAtRetirement = annualExpensesAtRetirement - annualOtherIncomeAtRetirement;

    Console.WriteLine($"Estimated monthly expenses at retirement: R{monthlyExpensesNow * Math.Pow(1 + inflation, yearsToRetirement):N0}");
    Console.WriteLine($"Other monthly income at retirement: R{(socialSecurityMonthly + pensionMonthly) * Math.Pow(1 + inflation, yearsToRetirement):N0}");
    Console.WriteLine($"Net annual withdrawal needed: R{netAnnualExpensesAtRetirement:N0}\n");

    // Target nest egg using 4% rule (25x annual expenses)
    double targetNestEgg = netAnnualExpensesAtRetirement / safeWithdrawalRate;
    Console.WriteLine($"Target retirement nest egg: R{targetNestEgg:N0}\n");

    // Binary search to find optimal contribution
    double minContribution = 0;
    double maxContribution = 50000; // Upper limit in ZAR
    double optimalContribution = 0;

    while (maxContribution - minContribution > 100) // Within R100 precision
    {
      double midContribution = (minContribution + maxContribution) / 2;

      // Check balanced scenario (middle risk profile)
      double finalSavings = ProjectFinalSavings(
          currentSavings,
          midContribution,
          yearsToRetirement,
          contributionGrowthRate,
          scenarios[1].nominalReturn - inflation
      );

      if (finalSavings >= targetNestEgg)
      {
        // We can achieve target with this contribution or less
        maxContribution = midContribution;
        optimalContribution = midContribution;
      }
      else
      {
        // Need higher contribution
        minContribution = midContribution;
      }
    }

    // Verify sufficiency across all scenarios
    Console.WriteLine("Optimal Monthly Contribution Results:");
    Console.WriteLine($"Suggested monthly contribution: R{optimalContribution:N0}\n");

    foreach (var scenario in scenarios)
    {
      double realReturn = scenario.nominalReturn - inflation;
      double finalSavings = ProjectFinalSavings(
          currentSavings,
          optimalContribution,
          yearsToRetirement,
          contributionGrowthRate,
          realReturn
      );

      // How many years this would last using dynamic withdrawal
      int yearsLasts = ProjectRetirementDuration(
          finalSavings,
          netAnnualExpensesAtRetirement,
          realReturn,
          inflation
      );

      double successPercentage = RunMonteCarloSimulation(
          finalSavings,
          netAnnualExpensesAtRetirement,
          desiredRetirementYears,
          scenario.nominalReturn - inflation,
          scenario.volatility,
          inflation
      );

      Console.WriteLine($"{scenario.name} Scenario (Nominal Return: {scenario.nominalReturn * 100:N1}%):");
      Console.WriteLine($"  - Projected Savings at Retirement: R{finalSavings:N0}");
      Console.WriteLine($"  - Years Covered: {yearsLasts}");
      Console.WriteLine($"  - Success Probability: {successPercentage:N1}%\n");
    }
  }

  static void RunDetailedSimulation(
      double currentSavings,
      int yearsToRetirement,
      double monthlyContribution,
      double contributionGrowthRate,
      double inflation,
      double monthlyExpensesNow,
      int desiredRetirementYears,
      double socialSecurityMonthly,
      double pensionMonthly,
      List<(string name, double nominalReturn, double volatility)> scenarios,
      double safeWithdrawalRate)
  {
    Console.WriteLine("=== DETAILED SIMULATION WITH CURRENT CONTRIBUTION ===\n");

    // Calculate annual expenses in retirement (adjusted for inflation)
    double annualExpensesAtRetirement = monthlyExpensesNow * 12 * Math.Pow(1 + inflation, yearsToRetirement);
    double annualOtherIncomeAtRetirement = (socialSecurityMonthly + pensionMonthly) * 12 * Math.Pow(1 + inflation, yearsToRetirement);
    double netAnnualExpensesAtRetirement = annualExpensesAtRetirement - annualOtherIncomeAtRetirement;

    foreach (var scenario in scenarios)
    {
      double realReturn = scenario.nominalReturn - inflation;
      double finalSavings = ProjectFinalSavings(
          currentSavings,
          monthlyContribution,
          yearsToRetirement,
          contributionGrowthRate,
          realReturn
      );

      // How many years this would last using dynamic withdrawal
      int yearsLasts = ProjectRetirementDuration(
          finalSavings,
          netAnnualExpensesAtRetirement,
          realReturn,
          inflation
      );

      double successPercentage = RunMonteCarloSimulation(
          finalSavings,
          netAnnualExpensesAtRetirement,
          desiredRetirementYears,
          scenario.nominalReturn - inflation,
          scenario.volatility,
          inflation
      );

      Console.WriteLine($"{scenario.name} Scenario (Nominal Return: {scenario.nominalReturn * 100:N1}%):");
      Console.WriteLine($"  - Projected Savings at Retirement: R{finalSavings:N0}");
      Console.WriteLine($"  - Years Covered: {yearsLasts}");
      Console.WriteLine($"  - Success Probability: {successPercentage:N1}%");

      // Cost of delay analysis
      // Cost of 1-year delay: lost growth + lost contributions
      double oneYearDelaySavings = ProjectFinalSavings(
          currentSavings,
          monthlyContribution,
          yearsToRetirement - 1,
          contributionGrowthRate,
          realReturn
      );

      // Account for lost growth on current savings for that year
      oneYearDelaySavings *= (1 + realReturn);

      Console.WriteLine($"  - Cost of 1-year delay: R{finalSavings - oneYearDelaySavings:N0}\n");
    }

    // Spending flexibility analysis
    Console.WriteLine("Spending Flexibility Analysis (Balanced Scenario):");
    double[] spendingFlexibilityRates = { 0.8, 0.9, 1.0, 1.1, 1.2 };
    double balancedRealReturn = scenarios[1].nominalReturn - inflation;
    double balancedFinalSavings = ProjectFinalSavings(
        currentSavings,
        monthlyContribution,
        yearsToRetirement,
        contributionGrowthRate,
        balancedRealReturn
    );

    foreach (double rate in spendingFlexibilityRates)
    {
      double adjustedExpenses = netAnnualExpensesAtRetirement * rate;
      int yearsLasts = ProjectRetirementDuration(
          balancedFinalSavings,
          adjustedExpenses,
          balancedRealReturn,
          inflation
      );

      Console.WriteLine($"  - {rate * 100:N0}% of planned spending: {yearsLasts} years");
    }

    // South African-specific considerations
    Console.WriteLine("\nSouth African Retirement Considerations:");
    Console.WriteLine("  - Consider tax implications of different retirement vehicles (RA, TFSA, etc.)");
    Console.WriteLine("  - Factor in potential Regulation 28 constraints on investment returns");
    Console.WriteLine("  - Account for potential rand depreciation if planning international travel");
    Console.WriteLine("  - Medical aid costs typically grow faster than inflation in South Africa");
  }

  static double ProjectFinalSavings(double currentSavings, double monthlyContribution, int years, double contributionGrowth, double realReturn)
  {
    double totalSavings = currentSavings;
    double monthlyReturn = Math.Pow(1 + realReturn, 1.0 / 12) - 1; // More accurate monthly compounding

    for (int year = 0; year < years; year++)
    {
      // Monthly compounding for more accuracy
      for (int month = 0; month < 12; month++)
      {
        // Calculate contribution for this month (distribute annual growth across months)
        double monthlyContributionAdjusted = monthlyContribution * Math.Pow(1 + contributionGrowth, year + month / 12.0);

        // Add contribution first, then apply monthly growth
        totalSavings += monthlyContributionAdjusted;
        totalSavings *= (1 + monthlyReturn);
      }
    }

    return totalSavings;
  }

  static int ProjectRetirementDuration(double savings, double firstYearExpenses, double realReturn, double inflation)
  {
    int yearsCovered = 0;
    double remainingSavings = savings;
    double yearlyExpenses = firstYearExpenses;

    // Using variable withdrawal - more realistic:
    // - First 10-15 years: "Go-Go" years with 100% spending
    // - Middle years: "Slow-Go" years with 80% spending
    // - Later years: "No-Go" years with 70% baseline but +10% medical

    while (remainingSavings > 0 && yearsCovered < 50) // Cap at 50 years to prevent infinite loop
    {
      // Adjust withdrawal based on retirement phase
      double withdrawalRate = 1.0;
      if (yearsCovered > 15 && yearsCovered <= 25)
      {
        // Slow-Go phase
        withdrawalRate = 0.8;
      }
      else if (yearsCovered > 25)
      {
        // No-Go phase with higher medical
        withdrawalRate = 0.7;

        // Add medical expense premium (higher in SA due to medical inflation)
        withdrawalRate += 0.15 * (yearsCovered - 25) / 10;
        withdrawalRate = Math.Min(withdrawalRate, 1.2); // Cap at 120% for SA medical costs
      }

      double actualWithdrawal = yearlyExpenses * withdrawalRate;

      // Check if we can afford this withdrawal
      if (remainingSavings < actualWithdrawal)
      {
        break; // Not enough funds
      }

      // Withdraw expenses
      remainingSavings -= actualWithdrawal;

      // Apply investment growth after withdrawal
      remainingSavings *= (1 + realReturn);

      // Adjust next year's expenses for inflation
      yearlyExpenses *= (1 + inflation);

      yearsCovered++;
    }

    return yearsCovered;
  }

  static double RunMonteCarloSimulation(double startingBalance, double annualWithdrawal, int targetYears, double expectedReturn, double volatility, double inflation, int iterations = 1000)
  {
    int successCount = 0;
    Random random = new Random();

    for (int i = 0; i < iterations; i++)
    {
      double balance = startingBalance;
      bool success = true;
      double yearlyWithdrawal = annualWithdrawal; // Fresh copy for each iteration

      for (int year = 0; year < targetYears; year++)
      {
        // Generate random annual return using log-normal distribution
        double randomReturn = GenerateRandomReturn(random, expectedReturn, volatility);

        // Apply return
        balance *= (1 + randomReturn);

        // Withdraw annual expenses
        balance -= yearlyWithdrawal;

        // Check if we've run out of money
        if (balance <= 0)
        {
          success = false;
          break;
        }

        // Increase withdrawal for next year (inflation is built into expectedReturn being real return)
        yearlyWithdrawal *= (1 + inflation); // South African inflation rate
      }

      if (success)
      {
        successCount++;
      }
    }

    return (double)successCount / iterations * 100;
  }

  static double GenerateRandomReturn(Random random, double expectedReturn, double volatility)
  {
    // Box-Muller transform to generate normal distribution
    double u1 = 1.0 - random.NextDouble();
    double u2 = 1.0 - random.NextDouble();
    double z = Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Sin(2.0 * Math.PI * u2);

    // Convert to log-normal distribution
    double mean = Math.Log(1.0 + expectedReturn) - 0.5 * volatility * volatility;
    double randomReturn = Math.Exp(mean + volatility * z) - 1.0;

    return randomReturn;
  }
}