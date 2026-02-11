export function extractObjectKey(url: string): string {
  try {
    const urlObj = new URL(url);
    // Lógica para Supabase Storage: .../storage/v1/object/public/[bucket]/[key]
    const pathParts = urlObj.pathname.split('/');
    const publicIndex = pathParts.indexOf('public');

    if (publicIndex !== -1 && pathParts[publicIndex + 1]) {
      // Retorna todo después del bucket (pathParts[publicIndex + 1] es el bucket)
      // Ejemplo: /public/bucket/folder/img.jpg -> folder/img.jpg
      // Si queremos incluir el bucket:
      // return pathParts.slice(publicIndex + 1).join('/');

      // Según la lógica usual de Supabase, la key relativa al bucket empieza después del nombre del bucket.
      // El formato es /public/<bucket>/<key>
      // pathParts: ['', 'storage', 'v1', 'object', 'public', 'bucket', 'folder', 'file.jpg']
      // publicIndex apunta a 'public'
      // publicIndex + 1 es el bucket
      // publicIndex + 2 empieza la key

      if (pathParts[publicIndex + 2]) {
        return pathParts.slice(publicIndex + 2).join('/');
      }
      // Fallback si no hay path profundo, quizás el bucket es parte de la key para otros usos,
      // pero para "key" de almacenamiento suele ser lo que está dentro.
      // Sin embargo, para compatibilidad con el código anterior en el servicio:
      /*
        const bucketIndex = pathParts.indexOf('public');
        if (bucketIndex !== -1 && pathParts[bucketIndex + 1]) {
          objectKey = pathParts.slice(bucketIndex + 1).join('/');
        }
      */
      // Ese código tomaba bucket + key. Vamos a replicar eso para ser seguros.
      return pathParts.slice(publicIndex + 1).join('/');
    }

    // Si no es Supabase o no sigue el patrón, usamos la URL path completa (o el pathname sin leading slash)
    if (urlObj.pathname.startsWith('/')) {
      return urlObj.pathname.substring(1);
    }
    return urlObj.pathname;
  } catch (error) {
    // Si no es una URL válida, asumimos que es ya una key o string
    return url;
  }
}
