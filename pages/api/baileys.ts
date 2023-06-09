import { Boom } from '@hapi/boom';
import NodeCache from 'node-cache';
import makeWASocket, { AnyMessageContent, delay, DisconnectReason, fetchLatestBaileysVersion, getAggregateVotesInPollMessage, makeCacheableSignalKeyStore, makeInMemoryStore, proto, useMultiFileAuthState, WAMessageContent, WAMessageKey } from '@whiskeysockets/baileys';
import P from 'pino';
import * as fsExtra from "fs-extra";
import eventEmitter from './eventEmitter';


const MAIN_LOGGER = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` });
const logger = MAIN_LOGGER.child({ enabled: false })
logger.level = 'trace'

const useStore = !process.argv.includes('--no-store')
const doReplies = !process.argv.includes('--no-reply')

// external map to store retry counts of messages when decryption/encryption fails
// keep this out of the socket itself, so as to prevent a message decryption/encryption loop across socket restarts
const msgRetryCounterCache = new NodeCache()

// start a connection
const startSock = async({ session_id, session_path, baileys_auth_info, baileys_store_multi_json }) => {

	// the store maintains the data of the WA connection in memory
	// can be written out to a file & read from it
	const store = useStore ? makeInMemoryStore({ logger }) : undefined
	store?.readFromFile(baileys_store_multi_json)
	// save every 10s
	const sessionWriter = setInterval(() => {
		store?.writeToFile(baileys_store_multi_json)
	}, 10_000)

	const { state, saveCreds } = await useMultiFileAuthState(baileys_auth_info)
	// fetch latest version of WA Web
	const { version, isLatest } = await fetchLatestBaileysVersion()
	console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

	const sock = makeWASocket({
		version,
		// logger,
		printQRInTerminal: false,
		auth: {
			creds: state.creds,
			/** caching makes the store faster to send/recv messages */
			keys: makeCacheableSignalKeyStore(state.keys , logger),
		},
		msgRetryCounterCache,
		generateHighQualityLinkPreview: true,
		// ignore all broadcast messages -- to receive the same
		// comment the line below out
		// shouldIgnoreJid: jid => isJidBroadcast(jid),
		// implement to handle retries & poll updates
		getMessage,
	})

	store?.bind(sock.ev)

	const broadcastChatList = () => {
		let chats = [];
		store.chats.all().forEach((chat) => {
			const _messages = store.messages[chat.id].array;
			if (Object.keys(chat).length > 3 && chat.id.indexOf('broadcast') === -1) {
				chats.push({
					id: chat.id,
					unreadCount: chat.unreadCount | 0,
					messages: store.messages[chat.id].array,
					conversationTimestamp: chat.conversationTimestamp
				});
			}
		});
		eventEmitter.emit('chats.set', { session_id, data: chats });
	}

	const sendMessageWTyping = async(msg: AnyMessageContent, jid: string) => {
		await sock.presenceSubscribe(jid)
		await delay(500)

		await sock.sendPresenceUpdate('composing', jid)
		await delay(2000)

		await sock.sendPresenceUpdate('paused', jid)

		await sock.sendMessage(jid, msg)
	}

	// the process function lets you process all events that just occurred
	// efficiently in a batch
	sock.ev.process(
		// events is a map for event name => event data
		async(events) => {
			// something about the connection changed
			// maybe it closed, or we received all offline message or connection opened
			if(events['connection.update']) {
				const update = events['connection.update']
				// client.emit('connection.update', update);
				const { connection, lastDisconnect } = update
				if(connection === 'close') {
					delete update['isNewLogin'];
					// reconnect if not logged out
					if((lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
						console.log("ERROR:", (lastDisconnect?.error as Boom)?.output?.statusCode);
						await startSock({ session_id, session_path, baileys_auth_info, baileys_store_multi_json });
					} else {
						fsExtra.emptyDirSync(session_path);
						console.log('Connection closed. You are logged out.');
						await startSock({ session_id, session_path, baileys_auth_info, baileys_store_multi_json });
					}
				}
				broadcastChatList();
				eventEmitter.emit('connection.update', { session_id, data: update });
				console.log('connection update', update)
			}

			// credentials updated -- save them
			if(events['creds.update']) {
				await saveCreds()
			}

			if(events['labels.association']) {
				// console.log(events['labels.association'])
			}


			if(events['labels.edit']) {
				// console.log(events['labels.edit'])
			}

			if(events.call) {
				// console.log('recv call event', events.call)
			}

			// history received
			if(events['messaging-history.set']) {
				const { chats, contacts, messages, isLatest } = events['messaging-history.set']
				// console.log(`recv ${chats.length} chats, ${contacts.length} contacts, ${messages.length} msgs (is latest: ${isLatest})`)
				broadcastChatList();
			}

			// received a new message
			if(events['messages.upsert']) {
				const upsert = events['messages.upsert']
				// console.log('recv messages ', JSON.stringify(upsert, undefined, 2))

				if(upsert.type === 'notify') {
					for(const msg of upsert.messages) {
						if(!msg.key.fromMe && doReplies) {
							// console.log('replying to', msg.key.remoteJid)
							await sock!.readMessages([msg.key])
							// await sendMessageWTyping({ text: 'Hello there!' }, msg.key.remoteJid!)
						}
					}
				}
			}

			// messages updated like status delivered, message deleted etc.
			if(events['messages.update']) {
				// console.log(JSON.stringify(events['messages.update'], undefined, 2))

				for(const { key, update } of events['messages.update']) {
					if(update.pollUpdates) {
						const pollCreation = await getMessage(key)
						if(pollCreation) {
							//console.log(
								//'got poll update, aggregation: ',
								//getAggregateVotesInPollMessage({
									//message: pollCreation,
									//pollUpdates: update.pollUpdates,
								//})
							//)
						}
					}
				}
				broadcastChatList();
			}

			if(events['message-receipt.update']) {
				// console.log(events['message-receipt.update'])
			}

			if(events['messages.reaction']) {
				// console.log(events['messages.reaction'])
			}

			if(events['presence.update']) {
				// console.log(events['presence.update'])
			}

			if(events['contacts.update']) {
				for(const contact of events['contacts.update']) {
					if(typeof contact.imgUrl !== 'undefined') {
						const newUrl = contact.imgUrl === null
							? null
							: await sock!.profilePictureUrl(contact.id!).catch(() => null)
						// console.log(`contact ${contact.id} has a new profile pic: ${newUrl}`,)
					}
				}
			}

			if(events['chats.upsert']) {
				broadcastChatList();
			}


			if(events['chats.update']) {
				broadcastChatList();
			}

			if(events['chats.delete']) {
				broadcastChatList();
			}
		}
	)

	async function getMessage(key: WAMessageKey): Promise<WAMessageContent | undefined> {
		if(store) {
			const msg = await store.loadMessage(key.remoteJid!, key.id!)
			return msg?.message || undefined
		}

		// only if store is present
		return proto.Message.fromObject({})
	}

	return { sock, sessionWriter }
}

export default startSock;
