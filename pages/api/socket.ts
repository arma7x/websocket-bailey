import { Server } from 'socket.io'
import { existsSync, mkdirSync } from 'fs';
import startSock from './baileys';
import eventEmitter from './eventEmitter';

function makeid(length): string {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

let sessions: {[key: string]: string} = {};
let clients: {[key: string]: string} = {};

let cached: {[key: string]: any} = {};

const SocketHandler = (req, res) => {

  if (res.socket.server.io) {
    console.log('Socket is already running')
  } else {
    console.log('Socket is initializing')
    const io = new Server(res.socket.server)
    res.socket.server.io = io

    eventEmitter.on('connection.update', evt => {
      const client_id = sessions[evt.session_id];
      if (client_id != null) {
        if (cached[evt.session_id] && cached[evt.session_id]['connection.update'] == null) {
          cached[evt.session_id]['connection.update'] = {};
        }
        cached[evt.session_id]['connection.update'] = { ...cached[evt.session_id]['connection.update'], ...evt.data };
        io.to(client_id).emit('connection.update', cached[evt.session_id]['connection.update']);
      }
    });

    eventEmitter.on('chats.set', evt => {
      const client_id = sessions[evt.session_id];
      if (client_id != null) {
        if (cached[evt.session_id] && cached[evt.session_id]['chats.set'] == null) {
          cached[evt.session_id]['chats.set'] = [];
        }
        cached[evt.session_id]['chats.set'] = evt.data;
        io.to(client_id).emit('chats.set', cached[evt.session_id]['chats.set']);
      }
    });

    io.on('connection', client => {

      client.on('init-session', async (msg) => {
        let session_id = msg;
        if (session_id == null) {
          session_id = makeid(50);
        }

        const session_path = `./sessions/${session_id}`;
        if (!existsSync(session_path)) {
          mkdirSync(session_path);
        }
        const baileys_auth_info = `./sessions/${session_id}/baileys_auth_info`;
        if (!existsSync(baileys_auth_info)) {
          mkdirSync(baileys_auth_info);
        }
        const baileys_store_multi_json = `./sessions/${session_id}/baileys_store_multi.json`;
        client.emit('init-session', session_id);

        if (sessions[session_id] != null) {
          delete clients[sessions[session_id]];
          sessions[session_id] = client.id;
          clients[client.id] = session_id;
          if (cached[session_id]) {
            Object.keys(cached[session_id]).forEach(key => {
              io.to(client.id).emit(key, cached[session_id][key]);
            });
          }
          return;
        }

        cached[session_id] = {};
        sessions[session_id] = client.id;
        clients[client.id] = session_id;
        await startSock({ session_id, session_path, baileys_auth_info, baileys_store_multi_json });
      });

      client.on('connect', () => {});

      client.on('disconnect', () => {});

    })
  }
  res.end()
}

export default SocketHandler
