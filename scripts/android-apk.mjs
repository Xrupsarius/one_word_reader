import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk && !existsSync(new URL('../android/local.properties', import.meta.url))) {
  console.error(
    'Android SDK не настроен. Установите Android Studio и SDK 36, затем задайте ANDROID_HOME или android/local.properties. Подробнее: docs/mobile.md',
  );
  process.exit(1);
}

const windows = process.platform === 'win32';
const result = spawnSync(windows ? 'gradlew.bat' : './gradlew', ['assembleDebug'], {
  cwd: new URL('../android/', import.meta.url),
  stdio: 'inherit',
  shell: windows,
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
