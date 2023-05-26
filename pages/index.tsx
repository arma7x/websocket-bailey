import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
//import { Inter } from 'next/font/google'
import styles from '@/styles/Home.module.css'

//const inter = Inter({ subsets: ['latin'] })

import QRCode from "react-qr-code";
import { useEffect, useState } from 'react';
import io from 'socket.io-client';
let socket;

function AttachmentsWidget(props) {

  const containerStyle: {[key: string]: number|string } = {
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#0000008c',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    zIndex: 9,
  }

  const bodyStyle: {[key: string]: number|string } = {
    position: 'relative',
    height: '70vh',
    width: '800px',
    backgroundColor: '#FFF',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  }

  const [index, setIndex] = useState(0);
  const [caption, setCaption] = useState('');

  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    if (props.setHandler)
      props.setHandler(selectFiles);
  }, []);

  function resolvePreview(file) {
    if (file.type.indexOf('image') > -1) {
      return <img style={{ width: 'auto', height: '40vh' }} src={URL.createObjectURL(file)} />
    }
    if (file.type.indexOf('video') > -1) {
      return <video style={{ width: 'auto', height: '40vh' }} src={URL.createObjectURL(file)} controls/>
    }
    return <div style={{ width: '200px', height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', }}>No Preview Available</div>
  }

  function resolveThumbnail(file) {
    if (file.type.indexOf('image') > -1) {
      return <img style={{ border: '1px solid #000', objectFit: 'cover', width: '50px', height: '50px' }} src={URL.createObjectURL(file)} />;
    }
    if (file.type.indexOf('video') > -1) {
      return <video style={{ border: '1px solid #000', objectFit: 'cover', width: '50px', height: '50px' }} src={URL.createObjectURL(file)} />;
    }
    return <div style={{ border: '1px solid #000', width: '50px', height: '50px', fontSize: '10px' }}>No Preview Available</div>;
  }

  function moveIndex(value) {
    setIndex(value);
    setCaption(attachments[value].caption);
  }

  function onCaptionChange(evt) {
    setCaption(evt.target.value);
    attachments[index].caption = evt.target.value;
  }

  function selectFiles() {
    const ref = document.getElementById('add-files');
      if (ref) ref.click();
  }

  function onSubmit() {
    if (props.onSuccess) {
      attachments.forEach((_, i) => {
        delete attachments[i].thumbnail;
        delete attachments[i].preview;
      });
      const temp = [...attachments];
      setAttachments([]);
      setIndex(0);
      props.onSuccess(temp);
    }
  }

  function onChange(evt) {
    let temp = [];
    [...evt.target.files].forEach((file) => {
      if (file.size > 0) {
        temp.push({ file, thumbnail: resolveThumbnail(file), preview: resolvePreview(file), caption: ''});
      }
    });
    setAttachments([...attachments, ...temp]);
    evt.target.value = '';
  }

  function removeAttachment(index) {
    const temp = attachments.splice(index, 1);
    setAttachments([...attachments]);
    if (attachments.length > 0) {
      setCaption(attachments[index].caption);
    }
    if (attachments.length == 0) {
      if (props.onCancel) {
        setIndex(0);
        props.onCancel();
      }
    }
  }

  function renderThumbnail(attachments) {
    return (
      <div style={{ overflowY: 'hidden', maxWidth: '700px', height: '70px', margin: '5px 0px', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        {
          attachments.map((attachment, i) =>
            <a key={i} style={{ cursor: 'pointer', marginRight: '5px' }} onClick={() => moveIndex(i)}>{attachment.thumbnail}</a>
          )
        }
      </div>
    );
  }

  return (<>
    <div style={{ ...containerStyle, visibility: (attachments.length == 0 ? 'hidden' : 'visible'), }}>
      <input id="add-files" type="file" name="files" style={{ border: 0, clip: 'rect(0 0 0 0)', height: '1px', margin: '-1px', overflow: 'hidden', padding: 0, position: 'absolute', width: '1px' }} onChange={onChange} multiple />
      { attachments.length > 0 && <div style={bodyStyle}>
        <div><button style={{ position: 'absolute', top:0 ,right:0 }} onClick={() => {
          setAttachments([]);
          setIndex(0);
          if (props.onCancel)
            props.onCancel();
        }}>X</button></div>
        {
          attachments.length > 0 &&
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
            <h5>{attachments[index].file.name}</h5>
            <button onClick={() => removeAttachment(index) }>x</button>
          </div>
        }
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
          { attachments.length > 0 && attachments[index].preview }
        </div>
        { renderThumbnail(attachments) }
        { attachments.length > 0 &&
          (
            <div style={{ width: '97%', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', }} >
              <button style={{ width: '8%', }} onClick={selectFiles}>Add</button>
              <textarea style={{ width: '82%', }} id="caption" type="text" value={caption} rows="4" placeholder="Please enter caption" onChange={onCaptionChange} />
              <button style={{ width: '8%', }} onClick={onSubmit}>Submit</button>
            </div>
          )
        }
      </div>
      }
    </div>
  </>);
}

export default function Home() {

  let handler;

  const [metadata, setMetadata] = useState({ connection: 'connecting' });
  const [qrCode, setQrCode] = useState('');
  const [chats, setChats] = useState([]);
  const [windows, setWindows] = useState('CHAT_LIST'); // CHAT_LIST || chat.id
  const [messages, setMessages] = useState([]);

  const resumeSession = () => {
    const session = window.localStorage.getItem('SESSION');
    socket.emit('init-session', session);
  }

  const socketInitializer = async () => {
    await fetch('/api/socket')

    socket = io();

    socket.on('connect', () => {
      resumeSession();
    });

    socket.on('init-session', session_id => {
      window.localStorage.setItem('SESSION', session_id);
    });

    // connection == 'open' || 'connecting' || 'close'
    socket.on('connection.update', data => {
      if (data != null) {
        setQrCode(data.qr || metadata.qr || '');
        setMetadata(data);
      }
    });

    socket.on('chats.set', data => {
      data.sort((a, b) => {
        return a.conversationTimestamp.low > b.conversationTimestamp.low;
      });
      // console.log(data);
      setChats(data);
    });
  }

  useEffect(() => {
    socketInitializer();
  }, []);

  function resolveMessage(message) {
    if (message.conversation)
      return <div>{message.conversation}</div>;
    if (message.templateMessage)
      return <div>{message.templateMessage.hydratedTemplate.hydratedContentText}</div>
  }

  function openChat(chat) {
    // console.log(chat);
    setMessages(chat._messages);
    setWindows(chat.id);
  }

  function showChatList() {
    setWindows('CHAT_LIST');
  }

  function onCancel() {}

  function onSuccess(attachments) {
    // TODO: https://github.com/WhiskeySockets/Baileys/tree/master#media-messages
    console.log("READY:", attachments);
  }

  return (
    <>
      <Head>
        <title>Whatsapp Baileys</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        {
          ['connecting', 'close'].indexOf(metadata.connection) === -1
          ? <div>
              {
                windows === 'CHAT_LIST' && chats.map((chat) =>
                  <a key={chat.id} onClick={() => openChat(chat)} style={{ cursor: 'pointer' }}>
                    <div style={{ backgroundColor: '#fff', marginBottom: '10px', border: '1px solid #000', padding: '5px', borderRadius: '5px' }}>
                      <div>{chat.id}</div>
                      <div>{chat.unreadCount}</div>
                      { resolveMessage(chat.messages[0].message.message) }
                      <div>{new Date(chat.conversationTimestamp.low * 1000).toString()}</div>
                    </div>
                  </a>
                )
              }
              {
                windows !== 'CHAT_LIST' &&
                <div style={{ position: 'relative' }}>
                  <button onClick={showChatList}>Go Back</button>
                  <div style={{ position: 'relative', height: '70vh', maxWidth: '800px', overflowY: 'scroll' }}>
                    <p>{ JSON.stringify(messages, null, 2) }</p>
                  </div>

                  <AttachmentsWidget setHandler={(_handler) =>  handler = _handler } onCancel={onCancel} onSuccess={onSuccess} />

                  <div style={{ position: 'absolute', bottom: -20, display: 'flex', flexDirection: 'row', width: '100%' }}>
                    <div style={{ width: '14%' }}>
                      <button onClick={() => {
                        if (handler)
                          handler();
                      }}>ATTACHMENT</button>
                    </div>
                    <div style={{ width: '76%' }}>
                      <input style={{ width: '99%' }} type="text" placeholder="Please enter message here" />
                    </div>
                    <div style={{ width: '10%' }}>
                      <button style={{ width: '100%' }}>SEND</button>
                    </div>
                  </div>
                </div>
              }
            </div>
          : <QRCode value={qrCode} />
        }
      </main>
    </>
  )
}
