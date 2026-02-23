/**
 * skills/telegram/handlers.ts
 * All bot command and callback-query handlers.
 */

import { Bot, Context, SessionFlavor, InlineKeyboard } from "grammy";
import type { AuthContext } from "../auth";
import {
  postCast,
  likeCast,
  unlikeCast,
  recast,
  unrecast,
  replyCast,
  quoteCast,
} from "../post";
import {
  getFeed,
  getReplies,
  getProfile,
  formatCast,
  formatProfile,
} from "../view";
import {
  parseCastCallback,
  castKeyboard,
  castKeyboardLiked,
  castKeyboardRecast,
} from "./keyboards";

// ── Session ────────────────────────────────────────────────────────────────────

export interface SessionData {
  /** Pending multi-step action awaiting user text input. */
  pending?: {
    type: "reply" | "quote";
    targetFid: number;
    targetHashHex: string;
    /** Message ID of the Telegram message showing the cast being acted on */
    refMsgId?: number;
  };
}

export type BotContext = Context & SessionFlavor<SessionData>;

// ── Guard ──────────────────────────────────────────────────────────────────────

const ALLOWED_USERS = (process.env.TELEGRAM_ALLOWED_USERS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map(Number);

function isAllowed(ctx: BotContext): boolean {
  if (ALLOWED_USERS.length === 0) return true;
  return ALLOWED_USERS.includes(ctx.from?.id ?? -1);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function sendCast(
  ctx: BotContext,
  auth: AuthContext,
  fid: number,
  hashHex: string,
  text: string
) {
  const profile = await getProfile(auth.client, fid).catch(() => undefined);
  const cast = { fid, hashHex, text, timestamp: new Date(), embeds: [] };
  const formatted = formatCast(cast, profile);
  await ctx.reply(formatted, {
    reply_markup: castKeyboard(fid, hashHex),
    parse_mode: undefined,
  });
}

// ── Command handlers ───────────────────────────────────────────────────────────

export function registerHandlers(bot: Bot<BotContext>, auth: AuthContext) {
  // /start
  bot.command("start", async (ctx) => {
    if (!isAllowed(ctx)) return;
    await ctx.reply(
      `👋 Clawberto HyperSnap Client\n\n` +
        `Commands:\n` +
        `/post <text> — publish a cast\n` +
        `/feed [fid]  — view recent casts (default: your FID)\n` +
        `/profile [fid] — show a profile\n` +
        `/node — node status\n` +
        `/cancel — cancel pending action`
    );
  });

  // /node
  bot.command("node", async (ctx) => {
    if (!isAllowed(ctx)) return;
    try {
      const info = await auth.client.getNodeInfo();
      const shards = info.shardInfos
        .map((s) => `  Shard ${s.shardId}: block delay ${s.blockDelay}`)
        .join("\n");
      await ctx.reply(
        `🖥️ HyperSnap Node\n` +
          `Shards: ${info.numShards}\n` +
          `Messages: ${info.dbStats.numMessages.toLocaleString()}\n` +
          `FIDs: ${info.dbStats.numFidRegistrations.toLocaleString()}\n` +
          shards
      );
    } catch (err) {
      await ctx.reply(`❌ Node unreachable: ${(err as Error).message}`);
    }
  });

  // /post <text>
  bot.command("post", async (ctx) => {
    if (!isAllowed(ctx)) return;
    const text = ctx.match?.trim();
    if (!text) {
      await ctx.reply("Usage: /post <your cast text>");
      return;
    }
    try {
      const msg = await postCast(auth, { text });
      const hashHex = "0x" + Buffer.from(msg.hash).toString("hex");
      await ctx.reply(`✅ Cast submitted!\nHash: ${hashHex}`);
    } catch (err) {
      await ctx.reply(`❌ Failed to post: ${(err as Error).message}`);
    }
  });

  // /feed [fid]
  bot.command("feed", async (ctx) => {
    if (!isAllowed(ctx)) return;
    const fidArg = ctx.match?.trim();
    const fid = fidArg ? parseInt(fidArg, 10) : auth.fid;
    if (isNaN(fid)) {
      await ctx.reply("Usage: /feed [fid]");
      return;
    }
    try {
      const casts = await getFeed(auth.client, fid, 5);
      if (casts.length === 0) {
        await ctx.reply(`No casts found for FID ${fid}.`);
        return;
      }
      const profile = await getProfile(auth.client, fid).catch(() => undefined);
      if (profile) {
        await ctx.reply(formatProfile(profile));
      }
      for (const cast of casts) {
        const formatted = formatCast(cast, profile);
        await ctx.reply(formatted, {
          reply_markup: castKeyboard(cast.fid, cast.hashHex),
        });
      }
    } catch (err) {
      await ctx.reply(`❌ Error: ${(err as Error).message}`);
    }
  });

  // /profile [fid]
  bot.command("profile", async (ctx) => {
    if (!isAllowed(ctx)) return;
    const fidArg = ctx.match?.trim();
    const fid = fidArg ? parseInt(fidArg, 10) : auth.fid;
    if (isNaN(fid)) {
      await ctx.reply("Usage: /profile [fid]");
      return;
    }
    try {
      const profile = await getProfile(auth.client, fid);
      await ctx.reply(formatProfile(profile));
    } catch (err) {
      await ctx.reply(`❌ Error: ${(err as Error).message}`);
    }
  });

  // /cancel
  bot.command("cancel", async (ctx) => {
    if (!isAllowed(ctx)) return;
    ctx.session.pending = undefined;
    await ctx.reply("✅ Cancelled.");
  });

  // ── Callback queries ─────────────────────────────────────────────────────────

  bot.on("callback_query:data", async (ctx) => {
    if (!isAllowed(ctx)) {
      await ctx.answerCallbackQuery("Not authorized.");
      return;
    }

    const parsed = parseCastCallback(ctx.callbackQuery.data);
    if (!parsed) {
      await ctx.answerCallbackQuery("Unknown action.");
      return;
    }

    const { action, fid, hashHex } = parsed;

    try {
      switch (action) {
        case "like":
          await likeCast(auth, fid, hashHex);
          await ctx.answerCallbackQuery("❤️ Liked!");
          await ctx.editMessageReplyMarkup({
            reply_markup: castKeyboardLiked(fid, hashHex),
          });
          break;

        case "unlike":
          await unlikeCast(auth, fid, hashHex);
          await ctx.answerCallbackQuery("💔 Unliked.");
          await ctx.editMessageReplyMarkup({
            reply_markup: castKeyboard(fid, hashHex),
          });
          break;

        case "recast":
          await recast(auth, fid, hashHex);
          await ctx.answerCallbackQuery("🔁 Recasted!");
          await ctx.editMessageReplyMarkup({
            reply_markup: castKeyboardRecast(fid, hashHex),
          });
          break;

        case "unrecast":
          await unrecast(auth, fid, hashHex);
          await ctx.answerCallbackQuery("↩️ Recast removed.");
          await ctx.editMessageReplyMarkup({
            reply_markup: castKeyboard(fid, hashHex),
          });
          break;

        case "reply":
          ctx.session.pending = {
            type: "reply",
            targetFid: fid,
            targetHashHex: hashHex,
            refMsgId: ctx.callbackQuery.message?.message_id,
          };
          await ctx.answerCallbackQuery("💬 Send your reply text.");
          await ctx.reply(
            `💬 Replying to cast by FID ${fid}...\nSend your reply text, or /cancel to abort.`
          );
          break;

        case "quote":
          ctx.session.pending = {
            type: "quote",
            targetFid: fid,
            targetHashHex: hashHex,
            refMsgId: ctx.callbackQuery.message?.message_id,
          };
          await ctx.answerCallbackQuery("📝 Send your quote text.");
          await ctx.reply(
            `📝 Quoting cast by FID ${fid}...\nSend your quote text, or /cancel to abort.`
          );
          break;

        case "thread":
          await ctx.answerCallbackQuery("Loading thread...");
          const replies = await getReplies(auth.client, fid, hashHex);
          if (replies.length === 0) {
            await ctx.reply("No replies yet.");
          } else {
            await ctx.reply(`🧵 ${replies.length} repl${replies.length === 1 ? "y" : "ies"}:`);
            for (const reply of replies.slice(0, 5)) {
              const rProfile = await getProfile(auth.client, reply.fid).catch(() => undefined);
              await ctx.reply(formatCast(reply, rProfile), {
                reply_markup: castKeyboard(reply.fid, reply.hashHex),
              });
            }
          }
          break;
      }
    } catch (err) {
      await ctx.answerCallbackQuery(`❌ ${(err as Error).message}`);
    }
  });

  // ── Pending text input (reply / quote) ────────────────────────────────────

  bot.on("message:text", async (ctx) => {
    if (!isAllowed(ctx)) return;
    const pending = ctx.session.pending;
    if (!pending) return; // not awaiting anything

    const text = ctx.message.text.trim();
    if (!text) return;

    try {
      if (pending.type === "reply") {
        const msg = await replyCast(
          auth,
          text,
          pending.targetFid,
          pending.targetHashHex
        );
        const newHashHex = "0x" + Buffer.from(msg.hash).toString("hex");
        await ctx.reply(`✅ Reply posted!\nHash: ${newHashHex}`);
      } else {
        const msg = await quoteCast(
          auth,
          text,
          pending.targetFid,
          pending.targetHashHex
        );
        const newHashHex = "0x" + Buffer.from(msg.hash).toString("hex");
        await ctx.reply(`✅ Quote cast posted!\nHash: ${newHashHex}`);
      }
    } catch (err) {
      await ctx.reply(`❌ Failed: ${(err as Error).message}`);
    } finally {
      ctx.session.pending = undefined;
    }
  });
}
