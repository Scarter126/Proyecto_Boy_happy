#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BoyHappyStack } from '../lib/boy_happy-stack';

const app = new cdk.App();

// IMPORTANTE: Especificar env para habilitar features dependientes de región/cuenta
// como CloudFront distributions, DynamoDB replication, etc.
new BoyHappyStack(app, 'BoyHappyStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },

  // Tags para organización y costos
  tags: {
    Project: 'BoyHappy',
    Environment: 'Production',
    ManagedBy: 'CDK'
  },

  // Descripción del stack
  description: 'BoyHappy - Sistema de gestión educativa (Frontend + Backend APIs)',
});