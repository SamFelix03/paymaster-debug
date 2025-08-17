# Issue: MetaMask Smart Account EIP-2612 Permit Signing Fails

## Steps to Reproduce
1. Install dependencies: `npm install`
2. Start the app: `npm run next-dev`
3. Open browser to `http://localhost:3000`
4. Click "🦊 Connect MetaMask" 
5. Click "Setup Account" (creates MetaMask smart account successfully)
6. Enter recipient address and amount (e.g. 0.1 USDC)
7. Click "Send Transaction"
8. **Error occurs** during permit signature creation

## Problem Summary
Attempting to use MetaMask smart accounts with EIP-2612 permit signatures for USDC paymaster integration. Smart account creation succeeds but `signTypedData` fails when creating permits.

## Error Details
```
❌ Transaction failed: Could not find an Account to execute with this Action. Please provide an Account with the `account` argument on the Action, or by supplying an `account` to the Client. Docs: https://viem.sh/docs/actions/wallet/signTypedData#account Version: viem@2.33.3
```

## Error Code
```typescript
// This line fails in signPermit function:
const signature = await account.signTypedData({
  primaryType: 'Permit',
  domain,
  types,
  message,
})
```

## Key Logs
```
✅ Owner address: 0x2514844F312c02Ae3C9d4fEb40db4eC8830b6844
✅ MetaMask smart account created: 0xbd1fC64F72717958c4ccbC41c417EFb7af0FEe20
📝 Creating EIP-2612 permit signature...
❌ ERROR: Could not find an Account to execute with this Action
```

## Environment
- **Network**: Arbitrum Sepolia
- **Owner EOA**: 0x2514844F312c02Ae3C9d4fEb40db4eC8830b6844  
- **Smart Account**: 0xbd1fC64F72717958c4ccbC41c417EFb7af0FEe20
- **Implementation**: MetaMask Delegation Toolkit (Hybrid)

## Root Cause Theories
1. MetaMask smart account incompatible with viem's `signTypedData`
2. Missing account context in wallet client configuration
3. EIP-2612 permits may need owner EOA signature, not smart account

## Questions
1. Should owner EOA sign permits instead of smart account?
2. Is there a different EIP-2612 pattern for MetaMask smart accounts?
3. Would EIP-7702 `toSimple7702SmartAccount` work better?

## Dependencies
- `viem: ^2.0.0`
- `@metamask/delegation-toolkit: ^0.13.0-rc.3`
