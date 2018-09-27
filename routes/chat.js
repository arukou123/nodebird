const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Room = require('../schemas/room');
const Chat = require('../schemas/chat');

const router = express.Router();


//----------------------------------메인화면 생성 화면을 렌더링 -------------------------------
router.get('/', async (req, res, next) => {
  try {
    const rooms = await Room.find({});
    res.render('chat/main', { rooms, title: 'GIF 채팅방', error: req.flash('roomError') });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

//----------------------------------채팅방 생성 화면을 렌더링 -------------------------------
router.get('/room', (req, res) => {
  res.render('chat/room', { title: 'GIF 채팅방 생성' });
});


//----------------------------------채팅방을 만드는 라우터 -------------------------------
router.post('/room', async (req, res, next) => {
  try {
    const room = new Room({
      title: req.body.title,
      max: req.body.max,
      owner: req.session.color,
      password: req.body.password,
    });
    const newRoom = await room.save();
    const io = req.app.get('io');    //저장했던 op 객체를 가져온다.
    io.of('/chat/room').emit('newRoom', newRoom);    // /roo, 네임스페이스에 연결한 모든 클라이언트에게 데이터를 보내는 메서드. main.pug의 newRoom 이벤트 리스너한테 보냄
    res.redirect(`/chat/room/${newRoom._id}?password=${req.body.password}`);  //get / 라우터에 접속한 모든 클라이언트가 새로 생성된 채팅방에 대한 데이터를 받을 수 있다.
  } catch (error) {
    console.error(error);
    next(error);
  }
});


//----------------------------------채팅방을 렌더링 -------------------------------
router.get('/room/:id', async (req, res, next) => {
  try {
    const room = await Room.findOne({ _id: req.params.id });
    const io = req.app.get('io');
    if (!room) {
      req.flash('roomError', '존재하지 않는 방입니다.');
      return res.redirect('/');
    }
    if (room.password && room.password !== req.query.password) {
      req.flash('roomError', '비밀번호가 틀렸습니다.');
      return res.redirect('/');
    }
    const { rooms } = io.of('/').adapter;        //방 목록이 들어있다.
    if (rooms && rooms[req.params.id] && room.max <= rooms[req.params.id].length) {   //해당 방의 소켓 목록이 나오면서 이걸 세가지고 인원 파악
      req.flash('roomError', '허용 인원이 초과하였습니다.');
      return res.redirect('/');
    }
    // ---------기존 채팅 내역을 불러오도록 수정 --------------
    const chats = await Chat.find({ room: room._id }).sort('createdAt');
    return res.render('chat/chat', {
    	room,
    	title: room.title,
    	chats,
    	user: req.session.color,
    })
  } catch (error) {
    console.error(error);
    return next(error);
  }
});


//---------------------------------- 채팅방을 삭제하는 라우터 -------------------------------
router.delete('/room/:id', async (req, res, next) => {
  try {
    await Room.remove({ _id: req.params.id });
    await Chat.remove({ room: req.params.id });
    res.send('ok');
    setTimeout(() => {
      req.app.get('io').of('/room').emit('removeRoom', req.params.id);   //2초 뒤에 삭제되었다는 removeRoom 이벤트를 /room 네임스페이스에게 알림
    }, 2000);
  } catch (error) {
    console.error(error);
    next(error);
  }
});


//---------------------------------- 채팅을 데이터베이스에 저장 후 같은 방에 전송 -------------------------------
router.post('/room/:id/chat', async (req, res, next) => {
	try {
		const chat = new Chat({
			room: req.params.id,
			user: req.session.color,
			chat: req.body.chat,
		});
		await chat.save();   //채팅을 데이터베이스에 저장
		req.app.get('io').of('/chat').to(req.params.id).emit('chat', chat);  //  to(방아이디).emit으로 같은 방에 들어 있는 소켓들에게 메시지 데이터를 전송
		res.send('ok');
	} catch (error) {
		console.error(error);
		next(error);
	}
});



fs.readdir('chatUploads', (error) => {
	if (error) {
		console.error('chatUploads 폴더가 없어 폴더를 생성합니다.');
		fs.mkdirSync('chatUploads');
	}
});
const upload = multer({
	storage: multer.diskStorage({
		destination(req, file, cb) {
			cb(null, 'chatUploads/');
		},
		filename(req, file, cb) {
			const ext = path.extname(file.originalname);
			cb(null, path.basename(file.originalname, ext) + new Date().valueOf() + ext);
		},
	}),
	limits: { fileSize: 5 * 1024 * 1024},
});


router.post('/room/:id/gif', upload.single('gif'), async (req, res, next) => {
	try{
		const chat = new Chat({
			room: req.params.id,
			user: req.session.color,
			gif: req.file.filename,
		});
		await chat.save();
		req.app.get('io').of('/chat').to(req.params.id).emit('chat', chat);
		res.send('ok');
	} catch (error) {
		console.error(error);
		next(error);
	}
});

module.exports = router;
