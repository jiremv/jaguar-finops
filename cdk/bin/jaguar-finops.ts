#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ScpGuardrailsStack } from '../lib/scp-guardrails-stack';
import { TagEnforcerStack } from '../lib/tag-enforcer-stack';
import { BudgetsStack } from '../lib/budgets-stack';

const app = new cdk.App();

new ScpGuardrailsStack(app, 'JaguarFinops-SCP', { env: { region: 'us-east-1' } });
new TagEnforcerStack(app, 'JaguarFinops-TagEnforcer', { env: { region: 'us-east-1' } });
new BudgetsStack(app, 'JaguarFinops-Budgets', { env: { region: 'us-east-1' } });
