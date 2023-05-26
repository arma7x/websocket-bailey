import { useEffect, useState } from 'react';

export default function AttachmentsWidget(props) {

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
      return (<img style={{ width: 'auto', height: '40vh' }} src={URL.createObjectURL(file)} />)
    }
    if (file.type.indexOf('video') > -1) {
      return (<video style={{ width: 'auto', height: '40vh' }} src={URL.createObjectURL(file)} controls />)
    }
    return (<div style={{ width: '200px', height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', }}>No Preview Available</div>)
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

  function close(evt) {
    if (evt.target.id?.indexOf("ATTACHMENTS_WIDGET") > -1) {
      setAttachments([]);
      setIndex(0);
      if (props.onCancel)
        props.onCancel();
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

  function removeAttachment(idx) {
    const temp = attachments.splice(idx, 1);
    setAttachments([...attachments]);
    let i = 0;
    if (index >= attachments.length) {
      i = index - 1;
      setIndex(i);
    }
    if (attachments.length > 0) {
      setCaption(attachments[i].caption);
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
    <div id="ATTACHMENTS_WIDGET_PARENT" style={{ ...containerStyle, visibility: (attachments.length == 0 ? 'hidden' : 'visible'), }} onClick={close}>
      <input id="add-files" type="file" name="files" style={{ border: 0, clip: 'rect(0 0 0 0)', height: '1px', margin: '-1px', overflow: 'hidden', padding: 0, position: 'absolute', width: '1px' }} onChange={onChange} multiple />
      { attachments.length > 0 && <div style={bodyStyle} onClick={(evt) => evt.stopPropagation()}>
        <div><button id="ATTACHMENTS_WIDGET_CLOSE" style={{ position: 'absolute', top:0 ,right:0 }} onClick={close}>X</button></div>
        {
          attachments.length > 0 &&
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
            <h5>{attachments[index].file.name}</h5>
            <button onClick={(evt) => {evt.stopPropagation();removeAttachment(index)} }>x</button>
          </div>
        }
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
          { attachments.length > 0 && attachments[index].preview }
        </div>
        { renderThumbnail(attachments) }
        { attachments.length > 0 &&
          (
            <div style={{ width: '97%', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', }} >
              <button style={{ width: '8%', }} onClick={(evt) => {evt.stopPropagation();selectFiles()}}>Add</button>
              <textarea style={{ width: '82%', }} id="caption" type="text" value={caption} rows="4" placeholder="Please enter caption" onChange={onCaptionChange} />
              <button style={{ width: '8%', }} onClick={(evt) => {evt.stopPropagation();onSubmit()}}>Submit</button>
            </div>
          )
        }
      </div>
      }
    </div>
  </>);
}
