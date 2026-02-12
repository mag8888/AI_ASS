import { Page } from 'puppeteer';

export async function sendMessageToUser(page: Page, username: string, message: string) {
    console.log(`Navigating to chat with @${username}...`);

    // Using direct URL navigation for Web K
    const targetUrl = `https://web.telegram.org/k/#@${username}`;
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });

    // Check if we are stuck on login page
    const loginSelector = '.login_head_submit_btn, .login_header';
    const chatSelector = '.chat-input-control';

    try {
        await page.waitForSelector(chatSelector, { timeout: 10000 });
    } catch (e) {
        // If chat input not found, maybe we are not logged in or user doesn't exist
        const isLoginPage = await page.$(loginSelector);
        if (isLoginPage) {
            throw new Error('User is not logged in. Please scan QR code first.');
        }
        throw new Error(`Chat with @${username} not found or failed to load. error: ${e}`);
    }

    console.log('Chat loaded. Typing message...');

    // Focus input
    const inputSelector = '.input-message-input';
    await page.click(inputSelector);

    // Human-like typing with random delays
    for (const char of message) {
        await page.type(inputSelector, char, { delay: Math.random() * 100 + 50 }); // 50-150ms delay
    }

    // Small delay before sending
    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));

    // Send message (Press Enter)
    await page.keyboard.press('Enter');

    console.log(`Message sent to @${username}`);
}

export async function checkLogin(page: Page): Promise<boolean> {
    try {
        // Check for common element in logged-in state (e.g., chat list, menu button)
        await page.waitForSelector('.chat-list, .sidebar-header', { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

export async function getChatName(page: Page): Promise<string> {
    try {
        const selectors = [
            '.chat-header .peer-title',
            '.chat-info .person-name',
            '.top .peer-title',
            '.chat-title',
            '.user-title'
        ];

        for (const selector of selectors) {
            const el = await page.$(selector);
            if (el) {
                const name = await page.evaluate(el => el.textContent, el);
                if (name && name.trim().length > 0) return name.trim();
            }
        }
        return "Unknown";
    } catch (e) {
        console.error("Failed to get chat name:", e);
        return "Unknown";
    }
}

export async function startDialogue(page: Page, username: string, referrer: string, topic: string) {
    console.log(`Starting dialogue with @${username}...`);

    // 1. Try Direct URL
    const targetUrl = username.includes('http') ? username : `https://web.telegram.org/k/#@${username}`;
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });

    const chatSelector = '.chat-input-control';
    const searchInputSelector = '.input-search > input';

    let chatFound = false;

    try {
        // Reduce timeout for direct nav since it might fail quickly
        await page.waitForSelector(chatSelector, { timeout: 5000 });
        chatFound = true;
    } catch (e) {
        console.log(`Direct navigation failed or timed out. Trying search for ${username}...`);

        // 2. Fallback to Search
        try {
            // Click search or focus input
            await page.waitForSelector(searchInputSelector, { timeout: 4000 }); // reduce timeout
            await page.click(searchInputSelector);

            // Clear input
            await page.keyboard.down('Meta');
            await page.keyboard.press('a');
            await page.keyboard.up('Meta');
            await page.keyboard.press('Backspace');

            // Type username
            await page.type(searchInputSelector, username, { delay: 100 });

            // Wait for results list to appear
            await new Promise(r => setTimeout(r, 3000));

            // LOGIC: Select the result
            let clicked = false;
            try {
                // Use page.evaluateHandle to get the element handle back to Node context
                const handle = await page.evaluateHandle((u) => {
                    const text = u;
                    const xpath = `//*[contains(text(), "${text}") or contains(text(), "@${text}")]`;
                    // @ts-ignore
                    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    return result.singleNodeValue;
                }, username);

                const element = handle.asElement();

                if (element) {
                    console.log("Found element handle. Trying mouse move & click...");

                    // Scroll into view first?
                    // @ts-ignore
                    await element.evaluate((el: any) => el.scrollIntoView({ block: 'center', inline: 'center' }));
                    await new Promise(r => setTimeout(r, 500));

                    const box = await element.boundingBox();
                    if (box) {
                        // Move mouse to center of element
                        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                        await page.mouse.down();
                        await new Promise(r => setTimeout(r, 100)); // nice click
                        await page.mouse.up();
                        clicked = true;
                    } else {
                        // Try JS click
                        await element.evaluate((el: any) => el.click());
                        clicked = true;
                    }
                }
            } catch (xErr) {
                console.log("XPath/Mouse click failed:", xErr);
            }

            // Fallback to keyboard navigation if click didn't work
            if (!clicked) {
                console.log("Mouse click failed/skipped, using Keyboard...");
                await page.keyboard.press('ArrowDown');
                await new Promise(r => setTimeout(r, 500));
                await page.keyboard.press('Enter');
            }

            // Check if it worked
            await page.waitForSelector(chatSelector, { timeout: 8000 });
            chatFound = true;

        } catch (searchErr) {
            const loginSelector = '.login_head_submit_btn, .login_header';
            const isLoginPage = await page.$(loginSelector);
            if (isLoginPage) {
                throw new Error('User is not logged in. Please scan QR code first.');
            }

            // Take screenshot for debug if possible
            const errorFile = `debug_error_${Date.now()}.png`;
            try { await page.screenshot({ path: errorFile }); } catch { }
            throw new Error(`Chat with @${username} not found via URL or Search. See ${errorFile}`);
        }
    }

    if (!chatFound) {
        throw new Error(`Failed to open chat with @${username}`);
    }

    // 3. Get User Name
    await new Promise(r => setTimeout(r, 2000));
    let name = await getChatName(page);
    console.log(`Detected name: ${name}`);

    if (!name || name === "Unknown" || name === "Saved Messages") {
        name = username;
    }

    // 4. Construct Message
    const message = `${name} - Здравствуйте, мне ваш контакт передал ${referrer}, сказал вы занимаетесь ${topic}`;

    console.log(`Generated message: "${message}"`);

    // 5. Send Message
    const inputSelector = '.input-message-input';

    // Ensure input is focused
    await page.click(inputSelector);

    for (const char of message) {
        // Typing speed variations
        await page.type(inputSelector, char, { delay: Math.random() * 100 + 40 });
    }

    await new Promise(r => setTimeout(r, 800 + Math.random() * 500));
    await page.keyboard.press('Enter');

    console.log(`Dialogue started with @${username}`);
    return { success: true, nameUsed: name, messageSent: message };
}
