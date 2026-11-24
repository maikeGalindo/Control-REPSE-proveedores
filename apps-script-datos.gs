// Pega esto en un Apps Script creado DESDE tu hoja (Extensiones → Apps Script).
// Antes: Configuración del proyecto (engrane) → Propiedades de la secuencia de comandos
// → agrega CLAVE = una contraseña larga inventada por ti.
function doGet(e) {
  var salida = function (o) {
    return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  };
  var clave = PropertiesService.getScriptProperties().getProperty('CLAVE');
  if (!clave || !e || e.parameter.k !== clave) return salida({ error: 'no autorizado' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var leer = function (nombre) {
    var sh = ss.getSheetByName(nombre);
    if (!sh) return [];
    var v = sh.getDataRange().getDisplayValues();
    var h = (v.shift() || []).map(function (x) { return String(x).trim().toLowerCase(); });
    return v
      .filter(function (r) { return r.join('').trim() !== ''; })
      .map(function (r) {
        var o = {};
        h.forEach(function (k, i) { o[k] = String(r[i] === undefined ? '' : r[i]).trim(); });
        return o;
      });
  };
  return salida({
    Proveedores: leer('Proveedores'),
    Pendientes: leer('Pendientes'),
    Meses: leer('Meses'),
    Info: leer('Info')
  });
}
