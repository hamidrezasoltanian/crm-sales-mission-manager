<?php
require_once __DIR__ . '/../helpers.php';
cors();
jsonOut(['ok' => true, 'ts' => (int)(microtime(true) * 1000), 'v' => API_VERSION]);
