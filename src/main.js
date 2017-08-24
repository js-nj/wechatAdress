//连接数据库
var mysql = require('mysql');
var https = require('https');
var async = require('async');
var querystring = require('querystring');
var connection = ''; //链接池
var targetTable = ''; //表名字
var keyWord = ''; //表id
var tokenObj = {}; //token对象
//根节点
var targetRootArray = [{
	"name": "教职工",
	"parentid": 1,
	"order": 1,
	"id": 2
}, {
	"name": "本科生",
	"parentid": 1,
	"order": 1,
	"id": 3
}];
(function() {
	// var time = 1000 * 60 * 60 * 24; //24小时
	// var time1 = 1000;
	// var id = setInterval(main, time1);
	//clearInterval(id);
	connection = mysql.createConnection({
		host: 'localhost',
		user: 'root',
		password: 'wisedu',
		database: 'local_wechat'
	});
	// Or, with named functions:
	async.waterfall([
		queryAccessToken,
		addStudentAndTeacherNode, //添加本科生与教职工节点
		addOrganizationNode, //给本科生与教职工分别添加架构表所有节点
		addSubOrganizationNode, //架构表存在二级节点，在本科生与教职工添加二级节点
		addClassToStudentNode,
		addTeachersToWechat,
		addStudentsToWechat,
	], function(err, result) {
		// result now equals 'done'
		console.log('----------over--------')
	});
})()
//查询accesstoken表
function queryAccessToken(callback) {
	connection.query('select * from `local_wechat_accesstoken`', function(err, rows, fields) {
		if (err) throw err;
		//console.log('local_wechat_accesstoken查询结果为: ', rows);
		if (rows && rows.length && rows.length > 0) {
			tokenObj = rows[0];
			if (tokenObj.accesstoken && tokenObj.creattime && ((new Date().getTime() - Number(tokenObj.creattime)) < 7200 * 1000)) {
				console.log('有token，并且没过期')
				global.access_token = tokenObj.accesstoken;
				callback(null, null);
				//console.log(targetItem)
				//addMemberFromTable(targetItem, callback);
			} else {
				requestAccessToken(callback);
			}
		} else {
			callback(null, null);
			console.log('未维护local_wechat_accesstoken数据表');
		}
	});

};

function addStudentAndTeacherNode(_result, callback) {
	async.forEachOf(targetRootArray, function(data, key, eachCallback) {
		var targetItem = data;
		var postData = JSON.stringify(targetItem);
		var options = {
			host: 'qyapi.weixin.qq.com',
			path: '/cgi-bin/department/create?access_token=' + global.access_token,
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				'Content-Length': Buffer.byteLength(postData)
			}
		};
		var req = https.request(options, function(res) {
			console.log('Status:', res.statusCode);
			res.setEncoding('utf-8');
			var datas = [];
			var size = 0;
			res.on('data', function(chun) {
				//loadCount++;
				console.log('addFromTable分隔线---------------------------------\r\n');
				var resultObj = JSON.parse(chun);
				if (resultObj.errcode == 0) {
					console.log('企业微信添加根节点成功')
					console.log('errmsg:' + resultObj.errmsg + ' errcode:' + resultObj.errcode);
					eachCallback(null, null);
				} else {
					console.log('企业微信添加根节点失败')
					console.log('errmsg:' + resultObj.errmsg + ' errcode:' + resultObj.errcode);
					eachCallback(null, null);
				}
			});
			res.on('end', function() {
				console.log('添加教职工、学生组织架构---------------------------------\r\n');
				//eachCallback(null, null);
			});
		});
		req.on('error', function(err) {
			console.error(err);
			eachCallback(null, null);
		});
		//发送传参
		req.write(postData);
		req.end();
	}, function(err) {
		callback(null, null);
	});
}

function addOrganizationNode(_result, callback) {
	console.log('addOrganizationNode-----------------');
	main('local_wechat_zzjgb', callback);
}

function addSubOrganizationNode(_result, callback) {
	console.log('addSubOrganizationNode-----------------');
	main('local_wechat_zzjgb', callback);
}

function addClassToStudentNode(_result, callback) {
	console.log('addClassToStudentNode-----------------');
	main('local_wechat_xybjb', callback);
}

function addTeachersToWechat(_result, callback) {
	console.log('addTeachersToWechat-----------------');
	main('local_wechat_jsxxb', callback);
}

function addStudentsToWechat(_result, callback) {
	console.log('addStudentsToWechat-----------------');
	main('local_wechat_xsxxb', callback);
}
//重新请求AccessToken
function requestAccessToken(callback) {
	//标识accesstoken过期了,或者为空，第一次请求
	var url = 'https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=' + tokenObj.corpid + '&corpsecret=' + tokenObj.corpsecret;
	https.get(url, function(res) {
		var datas = [];
		var size = 0;
		res.on('data', function(data) {
			datas.push(data);
			size += data.length;
		});
		res.on("end", function() {
			var buff = Buffer.concat(datas, size);
			var result = buff.toString();
			var resultObj = JSON.parse(result);
			// console.log('result:' + result)
			// console.log('result.errcode:' + result.errcode)
			//console.log('resultObj:' + resultObj)
			console.log('resultObj.errcode:' + resultObj.errcode)
			if (resultObj.errcode == 0) {
				console.log('request获取accesstoken分隔线---------------------------------\r\n');
				//console.info(buff);
				global.access_token = resultObj.access_token;
				//更新local_wechat_accesstoken表
				updateAccessToken(global.access_token, new Date().getTime(), callback);
				//addMemberFromTable(targetItem, callback);
			} else {
				callback(null, null);
				console.log('errmsg:' + resultObj.errmsg);
			}
		});
	}).on("error", function(err) {
		console.log(err)
		callback(null, null);
		//callback.apply(null);
	});
}
//主函数
function main(tableName, cb) {
	console.log(new Date());
	targetTable = tableName;
	if (targetTable.indexOf('xxb') > -1) {
		keyWord = 'userid';
	} else if ((targetTable.indexOf('zzjgb') > -1) || (targetTable.indexOf('xybjb') > -1)) {
		keyWord = 'wid';
	}
	//deleteErrorTable();
	var deleteErrorSql = 'DELETE FROM ' + targetTable + '_error';
	connection.query(deleteErrorSql, function(err, rows, fields) {
		if (err) throw err;
		console.log('每次同步前，先清空error数据表');
	});
	//deleteAndUpdateAddTable();
	//每次同步前，先清空add数据表
	var deleteAddSql = 'DELETE FROM ' + targetTable + '_add';
	connection.query(deleteAddSql, function(err, rows, fields) {
		if (err) throw err;
		//console.log('local_wechat_xsxxb_add删除结果为: ', rows);
		//同步增量表
		var insertAddSql = 'insert into  `' + targetTable + '_add` select*from `' + targetTable + '_copy` where ' + keyWord + ' not in(select ' + keyWord + ' from ' + targetTable + ')';
		connection.query(insertAddSql, function(err, rows, fields) {
			if (err) throw err;
			//查询增量表
			var selectAddSql = 'select * from `' + targetTable + '_add`';
			connection.query(selectAddSql, function(err, addrows, fields) {
				console.log('333333333333333333333')
				if (err) throw err;
				console.log(targetTable + '_add查询结果为: ', addrows.length);
				if (addrows && addrows.length && addrows.length > 0) {
					//是否是信息表
					if (targetTable.indexOf('xxb') > -1) {
						async.forEachOf(addrows, function(data, key, eachCallback) {
							var targetItem = data;
							if (data.userid && data.name) {
								if (data.mobile || data.email) {
									if (targetTable.indexOf('xsxxb') > -1) {
										targetItem.department = '3' + targetItem.department;
									} else if (targetTable.indexOf('jsxxb') > -1) {
										targetItem.department = '2' + targetItem.department;
									}
									addMemberFromTable(targetItem, eachCallback);
								} else {
									console.log('本条数据电话或邮箱不完整：mobile=' + data.mobile + ',email=' + data.email + ',请至少维护一项。添加失败！');
									updateErrorTable(targetItem, eachCallback);
								}
							} else {
								console.log('本条数据必填信息不完整：userid=' + data.userid + ',name=' + data.name + ';添加失败！');
								console.log('2222222222222222')
								updateErrorTable(targetItem, eachCallback);
							}
						}, function(err) {
							cb(null, null);
						});
					}
					//是否是组织架构表
					else if (targetTable.indexOf('zzjgb') > -1) {
						async.forEachOf(addrows, function(data, key, eachCallback) {
							var targetItem = data;
							var originParentId = targetItem.parentid;
							var originId = targetItem.id;
							if (data.id && data.name) {
								//兼容parentid为不填写的情况，不填写默认为父id为2,3
								async.forEachOf(targetRootArray, function(subdata, subkey, subeachCallback) {
									var subtargetItem = subdata;
									if (subtargetItem.id && subtargetItem.name) {
										//兼容parentid为不填写的情况，不填写默认为父id为2,3
										targetItem.parentid = Number(String(subtargetItem.id) + String(originParentId ? originParentId : ''));
										targetItem.id = Number(String(subtargetItem.id) + String(originId));
										console.log('targetItem.parentid:' + targetItem.parentid + ', targetItem.id:' + targetItem.id);
										addMemberFromTable(targetItem, subeachCallback);
									} else {
										console.log('本地根节点变量错误-------------');
									}
								}, function(err) {
									eachCallback(null, null);
								});
							} else {
								console.log('本条数据必填信息不完整：id=' + data.id + ',name=' + data.name + ';添加失败！');
								console.log('111111111111')
								updateErrorTable(targetItem, eachCallback);
							}
						}, function(err) {
							cb(null, null);
						});
					}
					//是否是学院班级表
					else if (targetTable.indexOf('xybjb') > -1) {
						async.forEachOf(addrows, function(data, key, eachCallback) {
							var targetItem = data;
							var originParentId = targetItem.parentid;
							var originId = targetItem.id;
							if (targetItem.bjdm && targetItem.ssxy) {
								var classIdLength = String(targetItem.bjdm).length;
								var classNodeObj = {
									name: targetItem.bjmc,
									id: Number('3' + targetItem.ssxy + String(targetItem.bjdm).substring(classIdLength - 2, classIdLength)),
									parentid: Number('3' + targetItem.ssxy),
									order: '1'
								};
								var classNodeObj = Object.assign(classNodeObj, targetItem);
								addMemberFromTable(classNodeObj, eachCallback);
							} else {
								console.log('本条数据必填信息不完整：bjmc:' + data.bjmc + ',bjdm=' + data.bjdm + ',name=' + data.name + ';添加失败！');
								console.log('111111111111')
								updateErrorTable(targetItem, eachCallback);
							}
						}, function(err) {
							cb(null, null);
						});
					}
				} else {
					cb(null, null);
					console.log('暂无新增数据')
				}
				//cb();
			});
		});
	});
}



function addMemberFromTable(item, callback) {
	//处理department参数
	var infoPerson = item;
	// var infoPerson = {
	// 	"userid": "lisisw2",
	// 	"name": "测试2号",
	// 	"english_name": "jackzhang",
	// 	"mobile": "15913215426",
	// 	"department": 1,
	// 	"order": 0,
	// 	"position": "经理",
	// 	"gender": "1",
	// 	"email": "lisisw2@gzdev.com",
	// 	"isleader": 1,
	// 	"enable": 1,
	// 	"telephone": "020-123456"
	// };
	//delete infoPerson.wid;
	console.log('infoPerson');
	//console.log(infoPerson);

	//只能用JSON的对象格式化，不能用querystring的字符串格式化
	//var postData = querystring.stringify(infoPerson);
	var postData = JSON.stringify(infoPerson);
	var options = {
		host: 'qyapi.weixin.qq.com',
		//port: 80,
		path: '/cgi-bin/user/create?access_token=' + global.access_token,
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
			'Content-Length': Buffer.byteLength(postData)
		}
	};
	//默认path是新增成员的
	if ((targetTable.indexOf('zzjgb') > -1) || (targetTable.indexOf('xybjb') > -1)) {
		options.path = '/cgi-bin/department/create?access_token=' + global.access_token;
	}
	console.log('addFromTable:-------------start--');
	//console.log(item)
	//console.log(options)
	var req = https.request(options, function(res) {
		console.log('Status:', res.statusCode);
		//console.log('headers:', JSON.stringify(res.headers));
		res.setEncoding('utf-8');
		var datas = [];
		var size = 0;
		var loadCount = 0;
		var completeLoadCount = 0;
		res.on('data', function(chun) {
			loadCount++;
			console.log('addFromTable分隔线---------------------------------\r\n');
			var resultObj = JSON.parse(chun);
			if (resultObj.errcode == 0) {
				console.log('向微信上creat成功')
				console.log('errmsg:' + resultObj.errmsg + ' errcode:' + resultObj.errcode);
				updateNormalTable(infoPerson, function() {
					completeLoadCount++;
					if (completeLoadCount === loadCount) {
						callback(null, null);
					}
				});
			} else {
				console.log('向微信上creat失败')
				console.log('errmsg:' + resultObj.errmsg + ' errcode:' + resultObj.errcode);
				updateErrorTable(infoPerson, function() {
					completeLoadCount++;
					if (completeLoadCount === loadCount) {
						callback(null, null);
					}
				});
			}
		});
		res.on('end', function() {
			console.log('44444444444444444444444444444')
			console.log('ending--------------------');
			//cb();
			// callback(null, null);
		});
	});
	console.log('add--------------middle')
	req.on('error', function(err) {
		console.error(err);
		callback(null, null);
	});
	//发送传参
	console.log(postData);
	req.write(postData);
	req.end();
}
//同步正式表
function updateNormalTable(item, callback) {
	console.log('同步正式表');
	var insertSql = 'insert into  `' + targetTable + '` select*from `' + targetTable + '_add` where ' + keyWord + '="' + item[keyWord] + '"';
	console.log(insertSql);
	connection.query(insertSql, function(err, rows, fields) {
		if (err) throw err;
		callback(null, null);
		//console.log('local_wechat_xsxxb插入结果为: ', rows);
	});
}
//同步错误表
function updateErrorTable(item, callback) {
	console.log('同步错误表');
	var insertSql = 'insert into  `' + targetTable + '_error` select*from `' + targetTable + '_add` where ' + keyWord + '="' + item[keyWord] + '"';
	console.log(insertSql);
	connection.query(insertSql, function(err, rows, fields) {
		// if (err) throw err;
		if (err) {
			console.log('------------------err-----------------')
		}
		if (callback) {
			callback(null, null);
		}
		console.log('5555555555555555555')
			//console.log('local_wechat_xsxxb_error插入结果为: ', rows);
	});
}
//更新同步AccessToken
function updateAccessToken(token, time, callback) {
	connection.query('UPDATE local_wechat_accesstoken SET accesstoken = ?,creattime = ?', [token, time], function(err, rows, fields) {
		if (err) throw err;
		callback(null, null);
		//console.log('local_wechat_accesstoken更新结果为: ', rows);
	});
}