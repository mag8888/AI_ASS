// Test script for /send endpoint
// Usage: npx ts-node test_send.ts <username> <message>

const username = process.argv[2] || 'test_user';
const message = process.argv[3] || 'Hello from AI Assistant!';

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testSend() {
    console.log(`Testing /send endpoint...`);
    console.log(`Target: @${username}`);
    console.log(`Message: "${message}"`);
    console.log(`API: ${API_URL}`);
    console.log('---');

    try {
        const response = await fetch(`${API_URL}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username,
                message,
            }),
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Success:', data);
        } else {
            console.error('❌ Error:', data);
        }
    } catch (error) {
        console.error('❌ Request failed:', error);
    }
}

testSend();
