/**
 * skills/telegram/bot.ts
 * Clawberto Telegram bot — entry point for the Telegram interface.
 * Requires TELEGRAM_BOT_TOKEN in .env.
 *
 * Run:  npm run bot
 */

import "dotenv/config";
import { Bot, session } from "grammy";
import { loadAuth } from "../auth";
import { registerHandlers, SessionData, BotContext } from "./handlers";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not set in .env");
    process.exit(1);
  }

  // Load HyperSnap auth (throws if node is unreachable or key is missing)
  const auth = await loadAuth();

  const bot = new Bot<BotContext>(token);

  // In-memory session (resets on restart; swap for a persistent store if needed)
  bot.use(
    session<SessionData, BotContext>({
      initial: (): SessionData => ({}),
    })
  );

  registerHandlers(bot, auth);

  bot.catch((err) => {
    console.error("[bot] Unhandled error:", err.message);
  });

  console.log("[bot] Starting polling...");
  await bot.start({
    onStart: (info) =>
      console.log(`[bot] Running as @${info.username} — connected to HyperSnap ${auth.client.config.grpcAddr}`),
  });
}

main();
