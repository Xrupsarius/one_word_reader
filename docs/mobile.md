# Android и iPhone

Приложение использует Capacitor 8.5.3. Нативные проекты находятся в `android/` и `ios/`, общий React/TypeScript-код — в `src/`. Идентификатор приложения: `com.xrupsarius.viewreader`, название на телефоне: «Читалка».

## Общая подготовка

```sh
npm ci
npm run native:sync
```

Команда собирает `dist-native/` и копирует его в оба нативных проекта. После каждого изменения веб-кода повторите синхронизацию. Папки с копиями веб-ресурсов исключены из Git: они восстанавливаются этой командой.

`npm run build` по-прежнему собирает PWA в `dist/`. `npm run build:native` собирает мобильную версию без service worker в `dist-native/`. В мобильном приложении код и PDF-шрифты находятся внутри установленного пакета, сервер и подключение к интернету для чтения не нужны. `server.url` для загрузки удалённого сайта не используется.

## Android

Требуются Android Studio 2025.2.1+, Android SDK Platform 36, Build Tools 36 и JDK 21. Для Gradle используйте JDK из Android Studio или установленный JDK 21; системная Java 25/27 не подходит для поставляемого Gradle 8.14.3. Минимальный Android — 7 (API 24), Android System WebView должен быть обновлён до современной версии.

Через Android Studio:

```sh
npm run android:sync
npm run android:open
```

Дождитесь загрузки Gradle-зависимостей, выберите эмулятор или подключённый телефон и нажмите Run. На телефоне включите режим разработчика и USB-отладку, подтвердите подключение к компьютеру.

Через терминал на Arch Linux, если SDK установлен в стандартное место Android Studio:

```sh
export ANDROID_HOME="$HOME/Android/Sdk"
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
npm run android:run
```

Укажите реальные пути своей установки. Вместо `ANDROID_HOME` можно создать локальный `android/local.properties` с `sdk.dir=/абсолютный/путь/к/SDK`. Этот файл не добавляется в Git.

Собрать установочный debug APK:

```sh
npm run android:apk
```

Результат: `android/app/build/outputs/apk/debug/app-debug.apk`. Его можно передать на телефон и установить, разрешив установку из выбранного источника, или выполнить:

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Debug APK предназначен для разработки. Для Google Play создайте подписанный Android App Bundle через Android Studio → Build → Generate Signed Bundle / APK. Ключ подписи и пароли храните отдельно от репозитория. Обновления должны использовать тот же appId и ключ подписи.

## iPhone / iPad

Нужен Mac с Xcode 26+ и Xcode Command Line Tools. На Arch Linux подготовка веб-кода и синхронизация работают, но собрать и подписать iOS-приложение здесь нельзя. В проекте выбран минимум iOS 17 из-за используемых веб-API; поддержка iOS 15/16 не заявлена.

На Mac:

```sh
npm ci
npm run ios:sync
npm run ios:open
```

В Xcode дождитесь разрешения Swift Package Manager зависимостей. Открывается `ios/App/App.xcodeproj`; CocoaPods для этого проекта не нужен.

Для симулятора выберите iPhone simulator и нажмите Run. Для физического iPhone:

1. Подключите iPhone к Mac, подтвердите доверие и включите Developer Mode.
2. В target App → Signing & Capabilities выберите свою Team и Automatic Signing.
3. Если bundle identifier занят в вашей Team, измените `appId` в `capacitor.config.ts` и идентификаторы в обоих нативных проектах согласованно до первого выпуска.
4. Выберите подключённое устройство и нажмите Run.

Для TestFlight/App Store нужны членство Apple Developer Program, подпись и запись приложения в App Store Connect. Используйте Product → Archive → Distribute App. Подписанный IPA в этом репозитории не создаётся и сертификаты не хранятся.

## Файлы, библиотека и обновления

Кнопка «Открыть книгу» использует системный выбор файла WebView. Специальный доступ ко всему хранилищу телефона не запрашивается. TXT, EPUB, FB2, DOCX и PDF по-прежнему разбираются в Worker; PDF.js использует вложенный Worker. Поделиться файлом из другого приложения через системное меню «Открыть в…» пока не реализовано.

Книги и позиции сохраняются в IndexedDB внутри WebView. Браузерная PWA, Android и iOS имеют отдельные библиотеки; автоматической синхронизации между устройствами нет. При обычном обновлении пакета с тем же идентификатором данные сохраняются, при удалении приложения или очистке его данных — удаляются. Резервное копирование Android для приложения выключено.

Иконки и экраны запуска уже подготовлены. При изменении `public/icon.svg` их можно пересоздать, установив ImageMagick:

```sh
node scripts/generate-native-assets.mjs
```

## Проверка

```sh
npm test
npm run format:check
npm run build
npm run native:sync
```

Проверены 46 веб-тестов, обе веб-сборки и синхронизация Android/iOS. В Chromium проверена мобильная сборка: импорт EPUB и PDF через Worker, восстановление позиции, отсутствие service worker и внешних запросов; ресурсы и конфигурации скопированы в оба проекта. APK и запуск на настоящем телефоне/эмуляторе требуют установленного Android SDK; iOS — Mac/Xcode. Перед выпуском проверьте на обоих устройствах: импорт всех форматов, Worker для PDF, сворачивание/возврат, восстановление позиции после перезапуска, системный выбор файлов, вырез экрана, клавиатуру и обе темы. Проверка мобильной веб-сборки в Chromium не заменяет проверку WebView на устройствах.

Документация Capacitor: [окружение](https://capacitorjs.com/docs/getting-started/environment-setup), [рабочий процесс](https://capacitorjs.com/docs/basics/workflow), [iOS и SPM](https://capacitorjs.com/docs/ios/spm).
