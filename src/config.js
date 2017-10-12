module.exports = {
	//数据库的环境信息
	dataBaseConfig: {
		host: 'localhost',
		user: 'root',
		password: 'wisedu',
		database: 'local_wechat'
	},
	tableFirstName: 'local_wechat',
	//访问主页的地址
	indexUrl: '',
	//服务的端口号
	port: 8080,
	//超级管理员，创建者
	superAdmin: 'yuqi',
	//白名单（主要是管理员）
	whiteID: ['yuqi', '01315123', 'xujiabin', '18362957269']
};