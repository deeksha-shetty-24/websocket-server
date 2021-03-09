const Socket = require("websocket").server
const http = require("http")
const url = require('url');

const server = http.createServer((req, res) => {
    const urlPath = url.parse(req.url, true).pathname;
    console.log(urlPath);
    if (req.method === 'GET' && urlPath === '/users') {
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(users.map(({ userName, fullName }) => ({ userName, fullName }))));
    }

    if (req.method === 'GET' && urlPath === '/validate-meeting') {
        const queryObject = url.parse(req.url, true).query;
        const userFound = users.find(x => x.userName === queryObject.username && !!x.meetingId);
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(!!userFound));
    }

    if (req.method === 'GET' && urlPath === '/delete-users') {
        deleteUsers();
    }
})

server.listen(process.env.PORT, () => {
    console.log("Listening on port 3000...")
})

const webSocket = new Socket({ httpServer: server })

let users = []

webSocket.on('request', (req) => {
    const connection = req.accept()

    connection.on('message', (message) => {
        const data = JSON.parse(message.utf8Data)

        const currentUser = findUser(data.userName);
        const calleeUser = findUser(data.calleeName);

        switch (data.type) {
            case "store_user":

                if (currentUser != null) {
                    return
                }

                const newUser = {
                    conn: connection,
                    userName: data.userName,
                    fullName: data.fullName
                }

                users.push(newUser)
                console.log(newUser.userName)

                sendToAll({
                    type: 'user_join',
                    userName: data.userName,
                    fullName: data.fullName
                });

                break;

            case "meeting_id":
                currentUser.meetingId = data.meetingId
                calleeUser.meetingId = data.meetingId
                console.log("Meeting Id:", currentUser.meetingId)
                break

            case "store_offer":
                currentUser.offer = data.offer
                console.log("Offer Received")
                break

            case "store_candidate":
                if (currentUser.candidates == null)
                    currentUser.candidates = []

                currentUser.candidates.push(data.candidate)
                console.log("Candidates received", currentUser.candidates.length);
                break

            case "send_answer":
                console.log("Answer Received");
                // if (currentUser == null) {
                //     return
                // }

                sendData({
                    type: "answer",
                    answer: data.answer
                }, calleeUser.conn)
                break

            case "send_candidate":
                // if (currentUser == null) {
                //     return
                // }

                sendData({
                    type: "candidate",
                    candidate: data.candidate
                }, calleeUser.conn)
                break

            case "join_call":
                // if (currentUser == null) {
                //     return
                // }
                console.log("Joined Call", data)

                sendData({
                    type: "offer",
                    offer: calleeUser.offer
                }, connection)
                console.log("Offer Sent")

                calleeUser.candidates.forEach(candidate => {
                    sendData({
                        type: "candidate",
                        candidate: candidate
                    }, connection)
                })
                console.log("Candidate Sent")
                calleeUser.candidates = [];
                break

            case "new_message":
                sendData({
                    type: "message",
                    message: data.message
                }, calleeUser.conn)
                break;

            case "end_call":
                console.log("Leave call")
                if (calleeUser) {
                    sendData({
                        type: "leave"
                    }, calleeUser.conn)
                }
                break;
        }
    })

    connection.on('close', (reason, description) => {
        console.log("Connection Closed")
        users.forEach(user => {
            if (user.conn == connection) {
                users.splice(users.indexOf(user), 1)
                return
            }
        })
    })
})

function sendData(data, conn) {
    conn.send(JSON.stringify(data))
}

function sendToAll(data) {
    for (const user of users.values()) {
        data.userName !== user.userName && user.conn.send(JSON.stringify(data));
    }
}

function findUser(userName) {
    for (let i = 0; i < users.length; i++) {
        if (users[i].userName == userName)
            return users[i]
    }
}

function deleteUsers() {
    users = [];
}