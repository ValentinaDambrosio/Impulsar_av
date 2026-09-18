<?php
/* Paso 1 de la migración: sacar todo de MySQL a un JSON.
 *
 * Este script se corre EN LA MÁQUINA DONDE VIVE LA BASE (la de Valentina, o el
 * hosting), no acá. Solo lee: no toca ni modifica nada.
 *
 *   php exportar_mysql.php > datos.json
 *
 * Después se copian `datos.json` y la carpeta `uploads/` completa a
 * Impulsar_fb/migracion/export/ y se corre importar_firebase.mjs.
 */

$DB_HOST = getenv("DB_HOST") ?: "localhost";
$DB_NAME = getenv("DB_NAME") ?: "nexo_tierras_schema";
$DB_USER = getenv("DB_USER") ?: "root";
$DB_PASS = getenv("DB_PASS") ?: "";

$pdo = new PDO(
    "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
    $DB_USER,
    $DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

function todo($pdo, $sql) {
    return $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
}

/* La columna `oficio` guardaba a veces un JSON y a veces un string suelto */
function decodificarOficios($valor) {
    $d = json_decode($valor, true);
    return is_array($d) ? $d : [$valor];
}

$trabajadores = todo($pdo, "
    SELECT provider_id, nombre, apellido, edad, celular, email, instagram,
           estudios, foto, password_hash, created_at
    FROM trabajadores ORDER BY created_at ASC
");

$usuarios = todo($pdo, "
    SELECT id, nombre, apellido, email, password_hash, created_at
    FROM usuarios ORDER BY created_at ASC
");

$oficios = todo($pdo, "
    SELECT id, provider_id, rubro, oficio, certificaciones, descripcion, created_at
    FROM oficios ORDER BY id ASC
");

$media = todo($pdo, "
    SELECT oficio_id, tipo, archivo FROM oficios_media ORDER BY id ASC
");

$ratings = todo($pdo, "
    SELECT provider_id, stars, ip_address, created_at FROM ratings ORDER BY id ASC
");

$vistas = todo($pdo, "
    SELECT provider_id, DATE(created_at) AS fecha, COUNT(*) AS cantidad
    FROM vistas_perfil GROUP BY provider_id, DATE(created_at)
");

$contactos = todo($pdo, "
    SELECT provider_id, tipo, COUNT(*) AS cantidad
    FROM contactos GROUP BY provider_id, tipo
");

$busquedas = todo($pdo, "
    SELECT termino, usuario_nombre, created_at FROM busquedas ORDER BY id ASC
");

/* Media agrupada por oficio, que es como queda guardada en Firestore */
$mediaPorOficio = [];
foreach ($media as $m) {
    $mediaPorOficio[$m["oficio_id"]][] = ["tipo" => $m["tipo"], "archivo" => $m["archivo"]];
}

foreach ($oficios as &$o) {
    $o["oficios"] = decodificarOficios($o["oficio"]);
    unset($o["oficio"]);
    $o["certificaciones"] = json_decode($o["certificaciones"] ?? "[]", true) ?: [];
    $o["media"] = $mediaPorOficio[$o["id"]] ?? [];
}
unset($o);

echo json_encode([
    "exportado_el" => date("c"),
    "trabajadores" => $trabajadores,
    "usuarios"     => $usuarios,
    "oficios"      => $oficios,
    "ratings"      => $ratings,
    "vistas"       => $vistas,
    "contactos"    => $contactos,
    "busquedas"    => $busquedas
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

fwrite(STDERR, sprintf(
    "Exportado: %d trabajadores, %d usuarios, %d oficios, %d ratings\n",
    count($trabajadores), count($usuarios), count($oficios), count($ratings)
));
