document.addEventListener('DOMContentLoaded', function () {
    const video = document.getElementById('video');
    const statusDiv = document.getElementById('status');
    const lastUrlDiv = document.getElementById('last-url');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');

    let scanning = false;
    let lastScannedUrl = '';
    let stream = null;
    let canvas = document.createElement('canvas');
    let context = canvas.getContext('2d');
    let user_id = 'user_' + Math.random().toString(36).substr(2, 9);
    let scanAnimationFrame = null;

    function showNotification(message, isSuccess = true) {
        const existingNotification = document.querySelector('.scan-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `scan-notification ${isSuccess ? 'success' : 'error'}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${isSuccess ? '#4CAF50' : '#f44336'};
            color: white;
            border-radius: 5px;
            z-index: 1000;
            font-weight: bold;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 3000);
    }

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        .scan-notification.success { background: #4CAF50 !important; }
        .scan-notification.error { background: #f44336 !important; }
    `;
    document.head.appendChild(style);

    async function sendToServer(qrUrl) {
        try {
            const response = await fetch('/api/qr-link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: user_id,
                    qr_url: qrUrl,
                    timestamp: new Date().toISOString()
                })
            });

            if (response.ok) {
                const result = await response.json();
                showNotification('QR-код успешно отправлен!', true);
                console.log('URL успешно отправлен на сервер:', result);
                return true;
            } else {
                throw new Error('Ошибка сервера: ' + response.status);
            }
        } catch (error) {
            console.error('Ошибка отправки:', error);
            showNotification('Ошибка отправки: ' + error.message, false);
            return false;
        }
    }

    // Сканирование одного кадра
    function scanFrame() {
        if (!scanning || !stream) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
            try {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

                // Используем jsQR для декодирования
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });

                if (code) {
                    if (code.data !== lastScannedUrl) {
                        lastScannedUrl = code.data;
                        lastUrlDiv.textContent = 'Последняя ссылка: ' + code.data;
                        statusDiv.textContent = 'Статус: QR найден!';
                        statusDiv.style.color = '#4CAF50';

                        // Отправляем на сервер
                        sendToServer(code.data);
                    }
                } else {
                    statusDiv.textContent = 'Статус: Сканирование...';
                    statusDiv.style.color = '#333';
                }
            } catch (error) {
                console.error('Ошибка при сканировании кадра:', error);
                statusDiv.textContent = 'Ошибка сканирования';
                statusDiv.style.color = '#f44336';
            }
        }

        if (scanning) {
            scanAnimationFrame = requestAnimationFrame(scanFrame);
        }
    }

    // Проверка поддержки камеры
    function checkCameraSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            statusDiv.textContent = 'Ваш браузер не поддерживает доступ к камере';
            statusDiv.style.color = '#f44336';
            startBtn.disabled = true;
            return false;
        }
        return true;
    }

    // Запуск камеры
    startBtn.addEventListener('click', async () => {
        if (!checkCameraSupport()) return;

        try {
            statusDiv.textContent = 'Статус: Запуск камеры...';
            statusDiv.style.color = '#333';

            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            video.srcObject = stream;
            scanning = true;
            startBtn.disabled = true;
            stopBtn.disabled = false;

            video.onloadedmetadata = () => {
                video.play().then(() => {
                    statusDiv.textContent = 'Статус: Сканирование...';
                    scanFrame();
                }).catch(error => {
                    console.error('Ошибка воспроизведения видео:', error);
                    statusDiv.textContent = 'Ошибка запуска видео: ' + error.message;
                    statusDiv.style.color = '#f44336';
                });
            };

            video.onerror = (error) => {
                console.error('Ошибка видео:', error);
                statusDiv.textContent = 'Ошибка видео';
                statusDiv.style.color = '#f44336';
                stopScanning();
            };

        } catch (error) {
            console.error('Ошибка доступа к камере:', error);
            statusDiv.textContent = 'Ошибка доступа к камере: ' + error.message;
            statusDiv.style.color = '#f44336';

            if (error.name === 'NotAllowedError') {
                statusDiv.textContent += '. Разрешите доступ к камере в настройках браузера';
            } else if (error.name === 'NotFoundError') {
                statusDiv.textContent += '. Камера не найдена';
            } else if (error.name === 'NotReadableError') {
                statusDiv.textContent += '. Камера уже используется другим приложением';
            }
        }
    });

    // Остановка сканирования
    function stopScanning() {
        scanning = false;

        if (scanAnimationFrame) {
            cancelAnimationFrame(scanAnimationFrame);
            scanAnimationFrame = null;
        }

        if (stream) {
            stream.getTracks().forEach(track => {
                track.stop();
                stream.removeTrack(track);
            });
            stream = null;
        }

        if (video.srcObject) {
            video.srcObject = null;
        }

        startBtn.disabled = false;
        stopBtn.disabled = true;
        statusDiv.textContent = 'Статус: Остановлено';
        statusDiv.style.color = '#666';
    }

    stopBtn.addEventListener('click', stopScanning);

    window.addEventListener('beforeunload', () => {
        stopScanning();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && scanning) {
            scanning = false;
            if (scanAnimationFrame) {
                cancelAnimationFrame(scanAnimationFrame);
                scanAnimationFrame = null;
            }
        } else if (!document.hidden && !scanning && stream) {
            scanning = true;
            scanFrame();
        }
    });

    checkCameraSupport();

    video.addEventListener('error', (e) => {
        console.error('Video error:', e);
        statusDiv.textContent = 'Ошибка видео элемента';
        statusDiv.style.color = '#f44336';
        stopScanning();
    });

    console.log('QR Scanner initialized for user:', user_id);
});