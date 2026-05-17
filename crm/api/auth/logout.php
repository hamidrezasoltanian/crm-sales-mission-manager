<?php
require_once __DIR__ . '/../helpers.php';
cors();
$token = str_replace('Bearer ', '', trim($_SERVER['HTTP_X_CRM_TOKEN'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? ''));
if ($token) getDB()->prepare("DELETE FROM sessions WHERE token=?")->execute([$token]);
jsonOut(['ok' => true]);
