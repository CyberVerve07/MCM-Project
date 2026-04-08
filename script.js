(function () {
    'use strict';

    var DB_NAME = 'prospectus_applications_db';
    var DB_VERSION = 1;
    var STORE_NAME = 'applications';

    function openDatabase() {
        return new Promise(function (resolve, reject) {
            if (!window.indexedDB) {
                return reject(new Error('IndexedDB is not supported in this browser.'));
            }

            var request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function (event) {
                var db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = function (event) {
                resolve(event.target.result);
            };

            request.onerror = function (event) {
                reject(event.target.error || new Error('Could not open IndexedDB.'));
            };
        });
    }

    function addApplication(application) {
        return openDatabase().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(STORE_NAME, 'readwrite');
                var store = tx.objectStore(STORE_NAME);
                var requester = store.add(application);

                requester.onsuccess = function () {
                    resolve();
                };
                requester.onerror = function (event) {
                    reject(event.target.error || new Error('Could not save application.'));
                };
            });
        });
    }

    function getApplications() {
        return openDatabase().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(STORE_NAME, 'readonly');
                var store = tx.objectStore(STORE_NAME);
                var request = store.openCursor();
                var results = [];

                request.onsuccess = function (event) {
                    var cursor = event.target.result;
                    if (cursor) {
                        results.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(results);
                    }
                };

                request.onerror = function (event) {
                    reject(event.target.error || new Error('Could not load applications.'));
                };
            });
        });
    }

    function showMessage(container, text, isError) {
        if (!container) return;
        container.textContent = text;
        container.classList.toggle('error', isError);
        container.classList.toggle('success', !isError);
        container.style.opacity = '1';
        setTimeout(function () {
            container.style.opacity = '0';
        }, 3500);
    }

    function setupForms() {
        document.querySelectorAll('.prospectus-form').forEach(function (form) {
            form.addEventListener('submit', function (event) {
                event.preventDefault();

                var name = form.querySelector('[name="name"]').value.trim();
                var email = form.querySelector('[name="email"]').value.trim();
                var phone = form.querySelector('[name="phone"]').value.trim();
                var course = form.querySelector('[name="course"]').value.trim();
                var message = form.querySelector('[name="message"]').value.trim();
                var statusEl = form.querySelector('.prospectus-message');

                if (!name || !email || !phone || !course) {
                    showMessage(statusEl, 'Please fill in all required fields.', true);
                    return;
                }

                var application = {
                    name: name,
                    email: email,
                    phone: phone,
                    course: course,
                    message: message,
                    createdAt: new Date().toISOString()
                };

                addApplication(application)
                    .then(function () {
                        form.reset();
                        form.querySelector('[name="course"]').value = course; // preserve course field on reset
                        showMessage(statusEl, 'Application received and saved successfully.', false);
                    })
                    .catch(function (error) {
                        console.error('DB save error:', error);
                        showMessage(statusEl, 'Could not save application. Please try again later.', true);
                    });
            });
        });
    }

    function renderApplicationsList() {
        var tableBody = document.querySelector('#applications-table-body');
        if (!tableBody) return;

        getApplications().then(function (applications) {
            tableBody.innerHTML = '';
            if (applications.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No applications found.</td></tr>';
                return;
            }

            applications.sort(function (a, b) {
                return new Date(b.createdAt) - new Date(a.createdAt);
            });

            applications.forEach(function (app) {
                var row = document.createElement('tr');
                row.innerHTML = '<td>' + app.id + '</td>' +
                    '<td>' + app.name + '</td>' +
                    '<td>' + app.email + '</td>' +
                    '<td>' + app.phone + '</td>' +
                    '<td>' + app.course + '</td>' +
                    '<td>' + new Date(app.createdAt).toLocaleString() + '</td>';
                tableBody.appendChild(row);
            });
        }).catch(function (error) {
            console.error('DB load error:', error);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        setupForms();
        renderApplicationsList();
    });

    window.prospectusDB = {
        addApplication: addApplication,
        getApplications: getApplications
    };
})();
