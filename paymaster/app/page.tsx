'use client'

import { useState, useEffect } from 'react'
import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  encodePacked,
  erc20Abi,
  parseUnits,
  formatUnits,
  hexToBigInt,
  custom,
} from 'viem'
import { arbitrumSepolia } from 'viem/chains'
import {
  createBundlerClient,
} from 'viem/account-abstraction'
import { maxUint256, parseErc6492Signature } from 'viem'
import { 
  Implementation, 
  toMetaMaskSmartAccount,
} from '@metamask/delegation-toolkit'

const PAYMASTER_V08_ADDRESS = '0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966'
const USDC_ADDRESS = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'

const eip2612Abi = [
  ...erc20Abi,
  {
    name: 'nonces',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    name: 'version',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    name: 'permit',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

interface Status {
  type: 'info' | 'success' | 'error'
  message: string
}

interface LogEntry {
  id: string
  timestamp: string
  type: 'info' | 'success' | 'error' | 'warning'
  message: string
}

export default function PaymasterDemo() {
  const [recipient, setRecipient] = useState('0x5732e1bccaeb161e3b93d126010042b0f1b9cfc9')
  const [amount, setAmount] = useState('0.1')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [accountInfo, setAccountInfo] = useState<{
    address: string
    smartAccountBalance: string
    ownerAddress: string
    ownerBalance: string
  } | null>(null)
  const [walletClient, setWalletClient] = useState<any>(null)
  const [isConnected, setIsConnected] = useState(false)

  const updateStatus = (type: Status['type'], message: string) => {
    setStatus({ type, message })
  }

  const addLog = (type: LogEntry['type'], message: string) => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    }
    setLogs(prev => [...prev, newLog])
  }

  const clearLogs = () => {
    setLogs([])
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setIsConnected(false)
          setWalletClient(null)
          setAccountInfo(null)
        }
      }

      window.ethereum.on('accountsChanged', handleAccountsChanged)
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
      }
    }
  }, [])

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      updateStatus('error', 'MetaMask is not installed')
      addLog('error', '❌ MetaMask not found. Please install MetaMask.')
      return
    }

    try {
      setLoading(true)
      addLog('info', '🦊 Connecting to MetaMask...')
      
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      
      const client = createWalletClient({
        chain: arbitrumSepolia,
        transport: custom(window.ethereum)
      })
      
      const addresses = await client.getAddresses()
      const ownerAddress = addresses[0]
      
      addLog('success', `✅ Connected to MetaMask: ${ownerAddress}`)
      
      setWalletClient(client)
      setIsConnected(true)
      updateStatus('success', 'MetaMask connected successfully')
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      addLog('error', `❌ Failed to connect: ${errorMsg}`)
      updateStatus('error', `Connection failed: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  const setupAccount = async () => {
    if (!isConnected || !walletClient) {
      updateStatus('error', 'Please connect MetaMask first')
      addLog('error', 'MetaMask wallet not connected')
      return
    }

    try {
      setLoading(true)
      clearLogs()
      addLog('info', '🔍 Setting up MetaMask smart account...')
      updateStatus('info', 'Setting up account...')

      addLog('info', '⚙️ Creating public client for Arbitrum Sepolia')
      const chain = arbitrumSepolia
      const publicClient = createPublicClient({ chain, transport: http() })
      
      addLog('info', '🔑 Getting MetaMask addresses')
      const addresses = await walletClient.getAddresses()
      const owner = addresses[0]
      addLog('success', `✅ Owner address: ${owner}`)
      
      addLog('info', '🧠 Creating MetaMask smart account')
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [owner, [], [], []],
        deploySalt: "0x",
        signatory: { walletClient },
      })
      addLog('success', `✅ MetaMask smart account created: ${smartAccount.address}`)

      // Log full smart account details
      addLog('info', '📋 Smart Account Details:')
      addLog('info', `   Address: ${smartAccount.address}`)
      addLog('info', `   Implementation: ${Implementation.Hybrid}`)
      addLog('info', `   Deploy Salt: 0x`)
      addLog('info', `   Owner: ${owner}`)

      setAccountInfo({
        address: smartAccount.address,
        smartAccountBalance: "0",
        ownerAddress: owner,
        ownerBalance: "0",
      })

      addLog('success', `✅ Account setup complete`)
      updateStatus('success', `Account ready for transactions`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      addLog('error', `❌ Account setup failed: ${errorMsg}`)
      updateStatus('error', `Error: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  const signPermit = async ({
    tokenAddress,
    client,
    account,
    spenderAddress,
    permitAmount,
  }: {
    tokenAddress: string
    client: any
    account: any
    spenderAddress: string
    permitAmount: bigint
  }) => {
    const token = getContract({ client, address: tokenAddress as `0x${string}`, abi: eip2612Abi })

    const domain = {
      name: await token.read.name(),
      version: await token.read.version(),
      chainId: client.chain.id,
      verifyingContract: tokenAddress as `0x${string}`,
    }

    const message = {
      owner: account.address,
      spender: spenderAddress,
      value: permitAmount.toString(),
      nonce: (await token.read.nonces([account.address])).toString(),
      deadline: maxUint256.toString(),
    }

    const types = {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    }

    // Use MetaMask smart account's signTypedData method - THIS WILL FAIL
    const signature = await account.signTypedData({
      primaryType: 'Permit',
      domain,
      types,
      message,
    })

    return signature
  }

  const sendTransaction = async () => {
    if (!isConnected || !walletClient || !recipient || !amount) {
      updateStatus('error', 'Please connect MetaMask and fill in all fields')
      addLog('error', 'MetaMask connection and all fields are required')
      return
    }

    try {
      setLoading(true)
      clearLogs()
      addLog('info', '🚀 Starting USDC transfer with paymaster...')
      updateStatus('info', 'Initializing transaction...')

      addLog('info', '⚙️ Setting up blockchain connection')
      const chain = arbitrumSepolia
      const publicClient = createPublicClient({ chain, transport: http() })
      
      addLog('info', '🔑 Getting MetaMask addresses')
      const addresses = await walletClient.getAddresses()
      const owner = addresses[0]
      
      addLog('info', '🧠 Creating MetaMask smart account')
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [owner, [], [], []],
        deploySalt: "0x",
        signatory: { walletClient },
      })
      addLog('success', `✅ MetaMask smart account: ${smartAccount.address}`)

      addLog('info', '💰 Preparing transfer amount')
      const usdc = getContract({ client: publicClient, address: USDC_ADDRESS, abi: erc20Abi })
      const amountParsed = parseUnits(amount, 6)
      addLog('info', `📤 Transfer amount: ${amount} USDC`)

      addLog('info', '📝 Creating EIP-2612 permit signature...')
      updateStatus('info', 'Creating permit signature...')
      
      const permitAmount = 10_000_000n
      addLog('info', `🔏 Permit amount: ${formatUnits(permitAmount, 6)} USDC`)
      
      const permitSignature = await signPermit({
        tokenAddress: USDC_ADDRESS,
        account: smartAccount,
        client: publicClient,
        spenderAddress: PAYMASTER_V08_ADDRESS,
        permitAmount,
      })
      addLog('success', '✅ Permit signature created')

      addLog('info', '📦 Encoding paymaster data')
      const paymasterData = encodePacked(
        ['uint8', 'address', 'uint256', 'bytes'],
        [0, USDC_ADDRESS, permitAmount, permitSignature]
      )

      const paymaster = {
        async getPaymasterData() {
          return {
            paymaster: PAYMASTER_V08_ADDRESS as `0x${string}`,
            paymasterData,
            paymasterVerificationGasLimit: 200000n,
            paymasterPostOpGasLimit: 15000n,
            isFinal: true,
          }
        },
      }
      addLog('success', `✅ Paymaster configured: ${PAYMASTER_V08_ADDRESS}`)

      addLog('info', '🌐 Creating bundler client with Pimlico')
      updateStatus('info', 'Creating bundler client...')
      const bundlerClient = createBundlerClient({
        account: smartAccount,
        client: publicClient,
        paymaster,
        userOperation: {
          estimateFeesPerGas: async ({ bundlerClient }) => {
            addLog('info', '⛽ Fetching gas prices from Pimlico')
            const { standard: fees } = await bundlerClient.request({
              method: 'pimlico_getUserOperationGasPrice',
            })
            return {
              maxFeePerGas: hexToBigInt(fees.maxFeePerGas),
              maxPriorityFeePerGas: hexToBigInt(fees.maxPriorityFeePerGas),
            }
          },
        },
        transport: http(`https://public.pimlico.io/v2/${publicClient.chain.id}/rpc`),
      })
      addLog('success', '✅ Bundler client created')

      addLog('info', '📤 Submitting user operation to bundler')
      addLog('info', `💸 Transferring ${amount} USDC to ${recipient}`)
      updateStatus('info', 'Sending user operation...')
      
      const uoHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        calls: [
          {
            to: usdc.address,
            abi: usdc.abi,
            functionName: 'transfer',
            args: [recipient as `0x${string}`, amountParsed],
          },
        ],
      })
      addLog('success', `✅ UserOperation submitted: ${uoHash}`)

      addLog('info', '⏳ Waiting for transaction confirmation...')
      updateStatus('info', `Waiting for confirmation... UserOp hash: ${uoHash}`)
      const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: uoHash })
      
      addLog('success', `🎉 Transaction confirmed!`)
      addLog('success', `📝 Transaction hash: ${receipt.receipt.transactionHash}`)
      addLog('success', `💸 Sent ${amount} USDC to ${recipient}`)
      addLog('success', `⛽ Gas paid with USDC via paymaster`)

      updateStatus(
        'success',
        `Transaction successful! Hash: ${receipt.receipt.transactionHash}`
      )
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      addLog('error', `❌ Transaction failed: ${errorMsg}`)
      updateStatus('error', `Transaction failed: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <h1>USDC Paymaster Demo</h1>
          <p>Pay gas fees with USDC using MetaMask Smart Accounts</p>
        </div>

        <div className="form-group">
          <label>MetaMask Connection</label>
          {!isConnected ? (
            <button
              className="button"
              onClick={connectWallet}
              disabled={loading}
              style={{ marginBottom: '1rem' }}
            >
              {loading ? <span className="loading"></span> : null}
              🦊 Connect MetaMask
            </button>
          ) : (
            <div style={{ 
              padding: '0.75rem', 
              background: '#e8f5e8', 
              border: '2px solid #4ade80', 
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              <div style={{ color: '#166534', fontWeight: '600' }}>
                ✅ MetaMask Connected
              </div>
              {accountInfo && (
                <div style={{ fontSize: '0.85rem', color: '#166534', marginTop: '0.25rem' }}>
                  Owner: {accountInfo.ownerAddress}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="recipient">Recipient Address</label>
          <input
            id="recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="amount">Amount (USDC)</label>
          <input
            id="amount"
            type="number"
            step="0.000001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.1"
          />
        </div>

        <button
          className="button"
          onClick={setupAccount}
          disabled={loading || !isConnected}
          style={{ marginBottom: '1rem' }}
        >
          {loading ? <span className="loading"></span> : null}
          Setup Account
        </button>

        <button
          className="button"
          onClick={sendTransaction}
          disabled={loading || !isConnected || !accountInfo}
        >
          {loading ? <span className="loading"></span> : null}
          Send Transaction
        </button>

        {status && (
          <div className={`status ${status.type}`}>
            {status.message}
          </div>
        )}

        <div className="logs-container">
          <div className="logs-header">
            <span>Transaction Logs</span>
            <button className="clear-logs" onClick={clearLogs}>
              Clear
            </button>
          </div>
          {logs.length === 0 ? (
            <div className="logs-empty">No logs yet. Run a transaction to see detailed steps.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className={`log-entry ${log.type}`}>
                <span className="log-timestamp">{log.timestamp}</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))
          )}
        </div>

        {accountInfo && (
          <div className="info-section">
            <h3>Account Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <strong>Owner (MetaMask) Address</strong>
                <span>{accountInfo.ownerAddress}</span>
              </div>
              <div className="info-item">
                <strong>MetaMask Smart Account</strong>
                <span>{accountInfo.address}</span>
              </div>
              <div className="info-item">
                <strong>Paymaster Address</strong>
                <span>{PAYMASTER_V08_ADDRESS}</span>
              </div>
              <div className="info-item">
                <strong>USDC Token Address</strong>
                <span>{USDC_ADDRESS}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}