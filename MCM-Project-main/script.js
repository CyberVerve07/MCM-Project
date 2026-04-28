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

    function getRegisteredUsers() {
        var stored = localStorage.getItem('registeredUsers');
        return stored ? JSON.parse(stored) : [];
    }

    function saveRegisteredUsers(users) {
        localStorage.setItem('registeredUsers', JSON.stringify(users));
    }

    function registerUser(user) {
        var users = getRegisteredUsers();
        var existing = users.find(function (item) {
            return item.email.toLowerCase() === user.email.toLowerCase();
        });

        if (existing) {
            return false;
        }

        users.push(user);
        saveRegisteredUsers(users);
        return true;
    }

    function findRegisteredUser(username) {
        var users = getRegisteredUsers();
        var key = username.trim().toLowerCase();
        return users.find(function (user) {
            return user.email.toLowerCase() === key || user.fullName.toLowerCase() === key;
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
                var type = form.dataset.formType || 'prospectus';
                var statusEl = form.querySelector('.prospectus-message') || createMessageElement(form);

                if (type === 'login') {
                    var username = form.querySelector('[name="username"]').value.trim();
                    var password = form.querySelector('[name="password"]').value.trim();

                    if (!username || !password) {
                        showMessage(statusEl, 'Please enter both username and password.', true);
                        return;
                    }

                    var registeredUser = findRegisteredUser(username);
                    if (!registeredUser) {
                        showMessage(statusEl, 'No id register', true);
                        return;
                    }

                    if (registeredUser.password !== password) {
                        showMessage(statusEl, 'Incorrect password. Please try again.', true);
                        return;
                    }

                    form.reset();
                    showMessage(statusEl, 'Login successful. Welcome back!', false);
                    return;
                }

                if (type === 'register') {
                    var fullName = form.querySelector('[name="fullName"]').value.trim();
                    var email = form.querySelector('[name="email"]').value.trim();
                    var phone = form.querySelector('[name="phone"]').value.trim();
                    var password = form.querySelector('[name="password"]').value.trim();
                    var confirmPassword = form.querySelector('[name="confirmPassword"]').value.trim();

                    if (!fullName || !email || !phone || !password || !confirmPassword) {
                        showMessage(statusEl, 'Please fill in all required fields.', true);
                        return;
                    }

                    if (password !== confirmPassword) {
                        showMessage(statusEl, 'Passwords do not match. Please check and try again.', true);
                        return;
                    }

                    var registered = registerUser({
                        fullName: fullName,
                        email: email,
                        phone: phone,
                        password: password,
                        createdAt: new Date().toISOString()
                    });

                    if (!registered) {
                        showMessage(statusEl, 'This email is already registered.', true);
                        return;
                    }

                    form.reset();
                    showMessage(statusEl, 'Thank you for registering! Your account has been created.', false);
                    return;
                }

                var name = (form.querySelector('[name="fullName"]') || form.querySelector('[name="name"]')).value.trim();
                var email = form.querySelector('[name="email"]').value.trim();
                var phone = form.querySelector('[name="phone"]').value.trim();
                var address = (form.querySelector('[name="address"]') || {value: ''}).value.trim();
                var course = (form.querySelector('[name="courseInterest"]') || form.querySelector('[name="course"]')).value;
                var deliveryMethod = (form.querySelector('[name="deliveryMethod"]') || {value: ''}).value;
                var message = (form.querySelector('[name="message"]') || {value: ''}).value.trim();

                if (!name || !email || !phone) {
                    showMessage(statusEl, 'Please fill in all required fields.', true);
                    return;
                }

                var application = {
                    name: name,
                    email: email,
                    phone: phone,
                    address: address,
                    course: course,
                    deliveryMethod: deliveryMethod,
                    message: message,
                    createdAt: new Date().toISOString()
                };

                addApplication(application)
                    .then(function () {
                        form.reset();
                        showMessage(statusEl, 'Application submitted successfully! We will contact you within 2-3 business days.', false);
                    })
                    .catch(function (error) {
                        console.error('DB save error:', error);
                        showMessage(statusEl, 'Could not submit application. Please try again later.', true);
                    });
            });
        });
    }

    function createMessageElement(form) {
        var messageEl = document.createElement('div');
        messageEl.className = 'prospectus-message';
        form.appendChild(messageEl);
        return messageEl;
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
