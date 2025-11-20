#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const cdk = __importStar(require("aws-cdk-lib"));
const boy_happy_stack_1 = require("../lib/boy_happy-stack");
const app = new cdk.App();
// IMPORTANTE: Especificar env para habilitar features dependientes de región/cuenta
// como CloudFront distributions, DynamoDB replication, etc.
new boy_happy_stack_1.BoyHappyStack(app, 'BoyHappyStack', {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm95X2hhcHB5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYm95X2hhcHB5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsaURBQW1DO0FBQ25DLDREQUF1RDtBQUV2RCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixvRkFBb0Y7QUFDcEYsNERBQTREO0FBQzVELElBQUksK0JBQWEsQ0FBQyxHQUFHLEVBQUUsZUFBZSxFQUFFO0lBQ3RDLEdBQUcsRUFBRTtRQUNILE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtRQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXO0tBQ3REO0lBRUQsa0NBQWtDO0lBQ2xDLElBQUksRUFBRTtRQUNKLE9BQU8sRUFBRSxVQUFVO1FBQ25CLFdBQVcsRUFBRSxZQUFZO1FBQ3pCLFNBQVMsRUFBRSxLQUFLO0tBQ2pCO0lBRUQsd0JBQXdCO0lBQ3hCLFdBQVcsRUFBRSxtRUFBbUU7Q0FDakYsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxyXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgeyBCb3lIYXBweVN0YWNrIH0gZnJvbSAnLi4vbGliL2JveV9oYXBweS1zdGFjayc7XHJcblxyXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xyXG5cclxuLy8gSU1QT1JUQU5URTogRXNwZWNpZmljYXIgZW52IHBhcmEgaGFiaWxpdGFyIGZlYXR1cmVzIGRlcGVuZGllbnRlcyBkZSByZWdpw7NuL2N1ZW50YVxyXG4vLyBjb21vIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9ucywgRHluYW1vREIgcmVwbGljYXRpb24sIGV0Yy5cclxubmV3IEJveUhhcHB5U3RhY2soYXBwLCAnQm95SGFwcHlTdGFjaycsIHtcclxuICBlbnY6IHtcclxuICAgIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQsXHJcbiAgICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAndXMtZWFzdC0xJ1xyXG4gIH0sXHJcblxyXG4gIC8vIFRhZ3MgcGFyYSBvcmdhbml6YWNpw7NuIHkgY29zdG9zXHJcbiAgdGFnczoge1xyXG4gICAgUHJvamVjdDogJ0JveUhhcHB5JyxcclxuICAgIEVudmlyb25tZW50OiAnUHJvZHVjdGlvbicsXHJcbiAgICBNYW5hZ2VkQnk6ICdDREsnXHJcbiAgfSxcclxuXHJcbiAgLy8gRGVzY3JpcGNpw7NuIGRlbCBzdGFja1xyXG4gIGRlc2NyaXB0aW9uOiAnQm95SGFwcHkgLSBTaXN0ZW1hIGRlIGdlc3Rpw7NuIGVkdWNhdGl2YSAoRnJvbnRlbmQgKyBCYWNrZW5kIEFQSXMpJyxcclxufSk7Il19