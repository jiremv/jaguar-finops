import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as budgets from 'aws-cdk-lib/aws-budgets';

export class BudgetsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const budget = new budgets.CfnBudget(this, 'FinopsCostCenterBudget', {
      budget: { budgetType: 'COST', timeUnit: 'MONTHLY', budgetLimit: { amount: 200, unit: 'USD' }, budgetName: 'Jaguar-FINOPS-CC-FINOPS' },
      notificationsWithSubscribers: [{ notification: { threshold: 80, thresholdType: 'PERCENTAGE', comparisonOperator: 'GREATER_THAN', notificationType: 'FORECASTED' }, subscribers: [] }],
      costFilters: { 'TagKeyValue': ['CostCenter$FINOPS'] }
    });
    new CfnOutput(this, 'BudgetName', { value: budget.budget!.budgetName! });
  }
}
