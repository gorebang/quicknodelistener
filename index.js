const WebSocket = require('ws');

// Your WebSocket endpoint
const wsEndpoint = 'wss://quiet-smart-mound.solana-mainnet.quiknode.pro/ee5cb3007a0f99b060ddfc92d9d905cb42395575';

// Token account, program IDs, and thresholds
const tokenAccount = 'FA1E4NT3EozZMDKVWBSQmMXdFqaKpmURF7tLLRYainBo';//Scott's Trojan Wallet
// const tokenAccount = 'BrNoqdHUCcv9yTncnZeSjSov8kqhpmzv1nAiPbq1M95H';//Our guy 
const tokenProgramId = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const dexProgramId = '9wFFqBpTnTZsVNpMJVU3ZxX3JAYPbivW2N2L6B7VioE'; // Example for Serum
const raydiumProgramId = 'AmmWh9bd5EwXiH4fW65xvopmcbSMRZ4R9Pg6jSPu1yA'; // Raydium V4 Program ID
const thresholdValue = 0.4152; // Example threshold for notification (adjust as needed)

// Connect to WebSocket
const ws = new WebSocket(wsEndpoint);

ws.on('open', () => {
    console.log('WebSocket connection established.');

    // Subscribe to account changes
    const subscriptionMessage = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'accountSubscribe',
        params: [
            tokenAccount,
            {
                encoding: 'jsonParsed',
            },
        ],
    });

    ws.send(subscriptionMessage);
    console.log(`Subscribed to account: ${tokenAccount}`);
});

ws.on('message', async (data) => {
    const response = JSON.parse(data);

    if (response.method === 'accountNotification') {
        try {
            // Safely access the account data
            const parsedData = response.params?.result?.value?.data?.parsed;
            const accountData = parsedData?.info?.tokenAmount?.uiAmount;

            if (accountData !== undefined) {
                console.log(`Account balance updated: ${accountData}`);
            } else {
                console.log('No tokenAmount data found in accountNotification.');
            }

            // Fetch recent transactions for the token account
            const signaturesMessage = JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'getSignaturesForAddress',
                params: [
                    tokenAccount,
                    { limit: 10 },
                ],
            });

            ws.send(signaturesMessage);
        } catch (error) {
            console.error('Error processing accountNotification:', error);
        }
    } else if (response.id === 2) {
        // Handle the response for getSignaturesForAddress
        try {
            const signatures = response.result;

            for (let signatureObj of signatures) {
                const transactionMessage = JSON.stringify({
                    jsonrpc: '2.0',
                    id: 3,
                    method: 'getTransaction',
                    params: [
                        signatureObj.signature,
                        { encoding: 'jsonParsed' },
                    ],
                });

                ws.send(transactionMessage);
            }
        } catch (error) {
            console.error('Error processing signatures response:', error);
        }
    } else if (response.id === 3) {
        // Handle transaction details
        try {
            const transaction = response.result;

            if (transaction) {
                const instructions = transaction.transaction.message.instructions;

                for (let ix of instructions) {
                    // Check for token transfer
                    if (
                        ix.programId === tokenProgramId &&
                        ix?.parsed?.type === 'transfer'
                    ) {
                        const source = ix.parsed.info?.source;
                        const destination = ix.parsed.info?.destination;
                        const amount = ix.parsed.info?.amount;

                        if (source === tokenAccount) {
                            console.log(
                                `Outgoing transfer detected! Amount: ${amount}, Destination: ${destination}`
                            );
                        }
                    }

                    // Check for Raydium swaps
                    if (ix.programId === raydiumProgramId) {
                        console.log('Raydium swap detected!');
                        const parsedInfo = ix?.parsed?.info;

                        if (parsedInfo) {
                            const fromAmount = parsedInfo?.amountIn;
                            const toAmount = parsedInfo?.amountOut;
                            const sourceToken = parsedInfo?.source;
                            const destinationToken = parsedInfo?.destination;

                            console.log(
                                `Swap detected: Sold ${fromAmount}, Bought ${toAmount}`
                            );
                            console.log(
                                `From Token: ${sourceToken}, To Token: ${destinationToken}`
                            );

                            // Add notification logic for high-value swaps
                            if (toAmount >= thresholdValue || fromAmount >= thresholdValue) {
                                console.log(
                                    `High-value swap detected! From: ${fromAmount}, To: ${toAmount}`
                                );
                            }
                        } else {
                            console.log('Raw Raydium instruction data:', ix);
                        }
                    }

                    // Handle PumpFun-specific instructions
                    if (ix.programId === '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P') { // Replace with actual PumpFun program ID
                        console.log('PumpFun transaction detected:', ix);
                    }
                }
            } else {
                console.log('No transaction details found.');
            }
        } catch (error) {
            console.error('Error processing transaction response:', error);
        }
    }
});

ws.on('close', () => {
    console.log('WebSocket connection closed.');
});

ws.on('error', (error) => {
    console.error('WebSocket error:', error);
});
