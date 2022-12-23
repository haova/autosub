export const padLeft = (value, length = 2) =>
  value.toString().padStart(length, '0')

export function formatTimestamp(
  timestamp,
  options = { format: 'SRT' }
) {
  const date = new Date(0, 0, 0, 0, 0, 0, timestamp)

  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = date.getSeconds()
  const ms = Math.floor(
    timestamp - (hours * 3600000 + minutes * 60000 + seconds * 1000)
  )

  return `${padLeft(hours)}:${padLeft(minutes)}:${padLeft(seconds)}${
    options.format === 'WebVTT' ? '.' : ','
  }${padLeft(ms, 3)}`
}

export const captionToString = (data) => {
  let content = '';
  let id = 0;

  for (let cap of data) {
    content += `${++id}\n${formatTimestamp(cap.start * 1000)} --> ${formatTimestamp(cap.end * 1000)}\n${cap.text}\n\n`;
  }

  return content;
}

export const download = (filename, text) => {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}