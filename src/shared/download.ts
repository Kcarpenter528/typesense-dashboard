import FileSaver from 'file-saver';

/** Offers text as a file download. */
export function saveText(text: string, filename: string, type = 'text/plain;charset=utf-8') {
  FileSaver.saveAs(new Blob([text], { type }), filename);
}

/** Offers a value as a pretty-printed JSON file download. */
export function exportToJson(value: unknown, filename = 'export.json') {
  saveText(JSON.stringify(value, null, 2), filename, 'application/json;charset=utf-8');
}
