import { Page } from 'puppeteer';
import prisma from './db';

interface IncomingMessage {
    chatName: string;
    username: string;
    text: string;
    isUnread: boolean;
}

/**
 * Poll Telegram Web for unread messages
 */
export async function pollIncomingMessages(page: Page): Promise<IncomingMessage[]> {
    try {
        const messages = await page.evaluate(() => {
            const results: any[] = [];

            // Find all chat items with unread badges
            const chatItems = document.querySelectorAll('.chatlist-chat');

            chatItems.forEach((chat) => {
                // Check for unread badge
                const unreadBadge = chat.querySelector('.badge-badge');
                if (!unreadBadge) return;

                // Extract chat name
                const nameEl = chat.querySelector('.user-title, .peer-title');
                const chatName = nameEl?.textContent?.trim() || 'Unknown';

                // Extract username (if available)
                const usernameEl = chat.querySelector('.user-last-message');
                const username = chatName; // Fallback to chat name

                // Extract last message preview
                const messageEl = chat.querySelector('.user-last-message, .message-text');
                const text = messageEl?.textContent?.trim() || '';

                results.push({
                    chatName,
                    username,
                    text,
                    isUnread: true
                });
            });

            return results;
        });

        return messages;
    } catch (error) {
        console.error('[Listener] Failed to poll messages:', error);
        return [];
    }
}

/**
 * Open a specific chat and scrape full message history
 */
export async function scrapeChat(page: Page, username: string): Promise<any[]> {
    try {
        console.log(`[Listener] Opening chat with @${username}...`);

        // Navigate to chat
        const targetUrl = `https://web.telegram.org/k/#@${username}`;
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 10000 });

        // Wait for chat to load
        await page.waitForSelector('.chat-input-control', { timeout: 5000 });
        await new Promise(r => setTimeout(r, 1000));

        // Extract messages
        const messages = await page.evaluate(() => {
            const bubbles = Array.from(document.querySelectorAll('.bubble'));
            return bubbles.map(b => {
                const isOut = b.classList.contains('is-out');
                const textEl = b.querySelector('.message, .text-content');
                const text = textEl?.textContent?.trim() || '';

                const timeEl = b.querySelector('.time');
                const time = timeEl?.textContent?.trim() || '';

                return {
                    sender: isOut ? 'SIMULATOR' : 'USER',
                    text,
                    time
                };
            }).filter(m => m.text && m.text.length > 0);
        });

        console.log(`[Listener] Scraped ${messages.length} messages from @${username}`);
        return messages;

    } catch (error) {
        console.error(`[Listener] Failed to scrape chat @${username}:`, error);
        return [];
    }
}

/**
 * Save messages to database
 */
async function saveMessages(username: string, chatName: string, messages: any[]) {
    try {
        // Find or create user
        let user = await prisma.user.findFirst({
            where: { telegramId: username }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    telegramId: username,
                    username: username,
                    firstName: chatName,
                    status: 'LEAD'
                }
            });
        }

        // Find or create dialogue
        let dialogue = await prisma.dialogue.findFirst({
            where: { userId: user.id, status: 'ACTIVE' },
            orderBy: { updatedAt: 'desc' }
        });

        if (!dialogue) {
            dialogue = await prisma.dialogue.create({
                data: {
                    userId: user.id,
                    status: 'ACTIVE'
                }
            });
        }

        // Get existing messages to avoid duplicates
        const existing = await prisma.message.findMany({
            where: { dialogueId: dialogue.id },
            orderBy: { id: 'desc' },
            take: 100
        });

        // Save new messages
        let savedCount = 0;
        for (const msg of messages) {
            const isDuplicate = existing.some(e =>
                e.text === msg.text && e.sender === msg.sender
            );

            if (!isDuplicate) {
                await prisma.message.create({
                    data: {
                        dialogueId: dialogue.id,
                        sender: msg.sender,
                        text: msg.text
                    }
                });
                savedCount++;
            }
        }

        console.log(`[Listener] Saved ${savedCount} new messages for @${username}`);

    } catch (error) {
        console.error('[Listener] Failed to save messages:', error);
    }
}

// Global flag to control listener loop
let isRunning = false;

export function stopListener() {
    isRunning = false;
    console.log('[Listener] Stopping...');
}

export async function startListener(page: Page) {
    if (isRunning) {
        console.log('[Listener] Listener was already running, stopping previous instance...');
        isRunning = false;
        await new Promise(r => setTimeout(r, 1000));
    }

    isRunning = true;
    console.log('[Listener] Starting message listener...');

    const pollLoop = async () => {
        if (!isRunning) return;

        try {
            // Check if page is still valid
            if (page.isClosed()) {
                console.log('[Listener] Page closed, stopping listener.');
                isRunning = false;
                return;
            }

            const url = page.url();
            if (url.includes('web.telegram.org')) {
                // Poll for unread messages
                const unreadChats = await pollIncomingMessages(page);

                if (unreadChats.length > 0) {
                    console.log(`[Listener] Found ${unreadChats.length} unread chats`);

                    // Process each unread chat
                    for (const chat of unreadChats) {
                        if (!isRunning) break;
                        const messages = await scrapeChat(page, chat.username);
                        await saveMessages(chat.username, chat.chatName, messages);
                    }

                    // Return to chat list after processing
                    if (isRunning && !page.isClosed()) {
                        try {
                            await page.goto('https://web.telegram.org/k/', { waitUntil: 'networkidle2', timeout: 10000 });
                        } catch (e) {
                            console.log('[Listener] Nav warning:', (e as Error).message);
                        }
                    }
                }
            }

        } catch (error) {
            // Ignore detached frame errors if stopping
            if (!isRunning || (error as Error).message.includes('detached Frame') || (error as Error).message.includes('Target closed') || (error as Error).message.includes('Session closed')) {
                console.log('[Listener] Frame detached or stopped.');
                isRunning = false;
                return;
            }
            console.error('[Listener] Polling error:', error);
        }

        if (isRunning) {
            setTimeout(pollLoop, 10000); // Poll every 10s
        }
    };

    pollLoop();
}
