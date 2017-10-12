//连接数据库
var mysql = require('mysql');
var https = require('https');
var http = require('http');
var server = http.createServer();
var url = require('url');
var fs = require("fs");
var async = require('async');
var lodash = require('lodash');
var querystring = require('querystring');
var schedule = require("node-schedule"); //定时执行任务
var config = require('./config');
var connection = ''; //链接池
var targetTable = ''; //表名字
var keyWord = ''; //表id
var tokenObj = {}; //token对象
var allOldOrganization = []; //所有的部门

/*-------------------------------------------server listen  start----------------------------------------*/

var requestFunction = function(req, res) {
	console.log('req.url:' + req.url);
	//主页
	if (req.url == '/index.html') {
		return homePage(req, res);
	}
	if (req.url.indexOf('/wechat/set') > -1) { //请求类
		var params = url.parse(req.url, true).query;
		if (params.type == 'sync') {
			letUsStart();
			res.writeHead(200, {
				"Content-Type": "text/html"
			});
			res.write(JSON.stringify({
				code: 0,
				msg: '同步成功'
			}));
			res.end();

		}
	}
}
var homePage = function(req, res) {
	console.log(req.url);
	fs.readFile("./" + req.url.substr(1), function(err, data) {
		if (err) {
			console.log(err);
			//404：NOT FOUND
			res.writeHead(404, {
				"Content-Type": "text/html"
			});
		} else {
			//200：OK
			res.writeHead(200, {
				"Content-Type": "text/html"
			});
			res.write(data.toString());
		}
		res.end();
	});
};
console.log('Server running at http://127.0.0.1:' + config.port + '/');
server.on('request', requestFunction);
server.listen(config.port, "127.0.0.1");

/*-------------------------------------------server listen  end----------------------------------------*/

/*-------------------------------------------sync address  start----------------------------------------*/
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
	// var rule = new schedule.RecurrenceRule();
	// rule.dayOfWeek = [0, new schedule.Range(1, 6)];
	// rule.hour = 23;
	// rule.minute = 59;
	// //console.log('schedule');
	// var j = schedule.scheduleJob(rule, function() {
	// 	//console.log("执行任务");
	// 	letUsStart();
	// });
	letUsStart();
})()

function test() {
	console.log(new Date() + '--------------------------\r\n');
}
//让我们开始同步吧
function letUsStart() {
	console.log('同步通讯录开始-----');
	connection = mysql.createConnection(config.dataBaseConfig);
	async.waterfall([
		queryAccessToken,
		addStudentAndTeacherNode, //添加本科生与教职工两个根节点
		addOrganizationNode, //教职工节点添加架构表节点
		addStuOrganizationNode, //本科生节点添加架构表节点
		addSubOrganizationNode, //教职工添加二级节点
		addClassToStudentNode,
		// addTeachersToWechat,
		// addStudentsToWechat,
	], function(err, result) {
		console.log('同步通讯录结束-----');
	});
}
//查询accesstoken表
function queryAccessToken(callback) {
	connection.query('select * from `' + config.tableFirstName + '_accesstoken`', function(err, rows, fields) {
		if (err) throw err;
		if (rows && rows.length && rows.length > 0) {
			tokenObj = rows[0];
			if (tokenObj.accesstoken && tokenObj.creattime) {
				if ((new Date().getTime() - Number(tokenObj.creattime)) < 7200 * 1000) {
					console.log('有token，并且没过期')
					global.access_token = tokenObj.accesstoken;
					callback(null, null);
				} else {
					requestAccessToken(callback);
				}
			} else {
				//第一次初始化时候进来，没有accesstoken,才走本分支
				requestAccessToken(callback, 'first');
			}
		} else {
			callback(null, null);
			console.log('未维护' + config.tableFirstName + '_accesstoken数据表');
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
			//console.log('Status:', res.statusCode);
			res.setEncoding('utf-8');
			var datas = [];
			var size = 0;
			res.on('data', function(chun) {
				var resultObj = JSON.parse(chun);
				if (resultObj.errcode == 0) {
					eachCallback(null, null);
				} else if (resultObj.errcode == 60008) {
					console.log('本科生与教职工节点已存在~');
					eachCallback(null, null);
				} else {
					console.log('添加本科生与教职工节点失败  -_-');
					console.log('errmsg:' + resultObj.errmsg + ' errcode:' + resultObj.errcode);
					eachCallback(null, null);
				}
			});
			res.on('end', function() {});
		});
		req.on('error', function(err) {
			console.error(err);
			eachCallback(null, null);
		});
		//发送传参
		req.write(postData);
		req.end();
	}, function(err) {
		if (err) {
			console.log(err);
		} else {
			console.log('添加本科生与教职工节点完毕~');
		}
		callback(null, null);
	});
}

function addOrganizationNode(_result, callback) {
	console.log('addOrganizationNode-----------------');
	main(config.tableFirstName + '_zzjgb', callback);
}

function addStuOrganizationNode(_result, callback) {
	console.log('addStuOrganizationNode-----------------');
	main(config.tableFirstName + '_zzjgb_stu', callback);
}

function addSubOrganizationNode(_result, callback) {
	console.log('addSubOrganizationNode-----------------');
	main(config.tableFirstName + '_zzjgb', callback);
}

function addClassToStudentNode(_result, callback) {
	console.log('addClassToStudentNode-----------------');
	main(config.tableFirstName + '_xybjb', callback);
}

function addTeachersToWechat(_result, callback) {
	console.log('addTeachersToWechat-----------------');
	main(config.tableFirstName + '_jsxxb', callback);
}

function addStudentsToWechat(_result, callback) {
	console.log('addStudentsToWechat-----------------');
	main(config.tableFirstName + '_xsxxb', callback);
}
//重新请求AccessToken
function requestAccessToken(callback, time) {
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
			if (resultObj.errcode == 0) {
				global.access_token = resultObj.access_token;
				//更新accesstoken表
				updateAccessToken(global.access_token, new Date().getTime(), callback, time);
			} else {
				callback(null, null);
				console.log('errmsg:' + resultObj.errmsg);
			}
		});
	}).on("error", function(err) {
		console.log(err)
		callback(null, null);
	});
}
//主函数
function main(tableName, cb) {
	//console.log(new Date());
	targetTable = tableName;
	if (targetTable.indexOf('xxb') > -1) {
		keyWord = 'userid';
	} else if ((targetTable.indexOf('zzjgb') > -1) || (targetTable.indexOf('xybjb') > -1)) {
		keyWord = 'wid';
	}
	//var deleteErrorSql = 'DELETE FROM ' + targetTable + '_error';
	// connection.query(deleteErrorSql, function(err, rows, fields) {
	// 	if (err) throw err;
	// 	//console.log('每次同步前，先清空error数据表');
	// });
	//直接查询增量数据
	//如果是查询学生信息表，需要联查学院班级表数据
	// if (targetTable.indexOf('xsxxb') > -1) {
	// 	var selectAddSql = 'select t1.*,t2.bz3 from `' + targetTable + '_tmp` t1 LEFT JOIN ' + config.tableFirstName + '_xybjb_tmp t2 on t1.classid=t2.bjdm;';
	// }
	if (targetTable.indexOf('stu') > -1) {
		var selectAddSql = 'select * from ' + config.tableFirstName + '_zzjgb_tmp where id in (select ssxy from ' + config.tableFirstName + '_xybjb_tmp)';
	} else {
		var selectAddSql = 'select * from `' + targetTable + '_tmp` where ' + keyWord + ' not in(select ' + keyWord + ' from ' + targetTable + ')';
	}
	connection.query(selectAddSql, function(err, addrows, fields) {
		if (addrows && addrows.length && addrows.length > 0) {
			console.log(targetTable + '表新增' + addrows.length + '条数据');
			//是否是信息表
			if (targetTable.indexOf('jsxxb') > -1) {
				async.forEachOf(addrows, function(data, key, eachCallback) {
					var targetItem = data;
					if (data.userid && data.name && data.department) {
						if (data.mobile || data.email) {
							if (targetItem.department != '2') {
								targetItem.department = '2' + targetItem.department;
							}
							addMemberFromTable(targetItem, eachCallback);
						} else {
							console.log('userid=' + data.userid + ',name=' + data.name + '条数据电话或邮箱不完整,请至少维护一项。添加失败！');
							updateErrorTable(targetItem, eachCallback);
						}
					} else {
						console.log('本条数据必填信息不完整：userid=' + data.userid + ',name=' + data.name + ';添加失败！');
						updateErrorTable(targetItem, eachCallback);
					}
				}, function(err) {
					cb(null, null);
				});
			} else if (targetTable.indexOf('xsxxb') > -1) {
				async.forEachOf(addrows, function(data, key, eachCallback) {
					var targetItem = data;
					if (data.userid && data.name && data.department) {
						if (data.mobile || data.email) {
							if (targetItem.department != '3') {
								targetItem.department = '3' + targetItem.department + targetItem.classid;
							}
							addMemberFromTable(targetItem, eachCallback);
						} else {
							console.log('userid=' + data.userid + ',name=' + data.name + '条数据电话或邮箱不完整,请至少维护一项。添加失败！');
							updateErrorTable(targetItem, eachCallback);
						}
					} else {
						console.log('本条数据必填信息不完整：userid=' + data.userid + ',name=' + data.name + ';添加失败！');
						updateErrorTable(targetItem, eachCallback);
					}
				}, function(err) {
					cb(null, null);
				});
			} else if (targetTable.indexOf('zzjgb') > -1) { //是否是组织架构表
				async.forEachOf(addrows, function(data, key, eachCallback) {
					var targetItem = data;
					var originParentId = targetItem.parentid;
					var originId = targetItem.id;
					if (data.id && data.name) {
						//兼容parentid为不填写的情况，不填写默认为父id为2,3
						var parentId = '';
						if (targetTable.indexOf('stu') > -1) {
							parentId = 3;
						} else {
							parentId = 2;
						}
						if (originParentId && String(originParentId).length > 1) {
							targetItem.parentid = Number(String(parentId) + String(originParentId ? originParentId : ''));
						} else if (originParentId && String(originParentId).length == 1) {
							targetItem.parentid = originParentId;
						} else {
							targetItem.parentid = parentId;
						}
						targetItem.id = Number(String(parentId) + String(originId));
						addMemberFromTable(targetItem, eachCallback);
					} else {
						console.log('本条数据必填信息不完整：id=' + data.id + ',name=' + data.name + ';添加失败！');
						updateErrorTable(targetItem, eachCallback);
					}
				}, function(err) {
					if (err) {
						console.log(err);
					} else {
						console.log('添加组织架构表完毕~');
					}
					cb(null, null);
				});
			} else if (targetTable.indexOf('xybjb') > -1) { //是否是学院班级表
				async.forEachOf(addrows, function(data, key, eachCallback) {
						var targetItem = data;
						var originParentId = targetItem.parentid;
						var originId = targetItem.id;
						if (targetItem.bjdm && targetItem.ssxy) {
							var classNodeObj = {
								name: targetItem.bjmc,
								id: Number('3' + targetItem.ssxy + String(targetItem.bjdm)),
								parentid: Number('3' + targetItem.ssxy),
								order: '1'
							};
							var classNodeObj = Object.assign(classNodeObj, targetItem);
							addMemberFromTable(classNodeObj, eachCallback);
						} else {
							console.log('本条数据必填信息不完整：bjmc:' + data.bjmc + ',bjdm=' + data.bjdm + ',name=' + data.name + ';添加失败！');
							updateErrorTable(targetItem, eachCallback);
						}
					},
					function(err) {
						if (err) {
							console.log(err);
						} else {
							console.log('添加学院班级表完毕~');
						}
						cb(null, null);
					});
			}
		} else {
			console.log(targetTable + '表暂无新增数据');
			cb(null, null);
		}
	});
}

function addMemberFromTable(item, callback) {
	//处理department参数
	var infoPerson = item;
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
	var req = https.request(options, function(res) {
		res.setEncoding('utf-8');
		var datas = [];
		var size = 0;
		var loadCount = 0;
		var completeLoadCount = 0;
		res.on('data', function(chun) {
			loadCount++;
			var resultObj = JSON.parse(chun);
			if (resultObj.errcode == 0) {
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
		res.on('end', function() {});
	});
	req.on('error', function(err) {
		console.error(err);
		callback(null, null);
	});
	req.write(postData);
	req.end();
}
//同步正式表
function updateNormalTable(item, callback) {
	var insertSql = 'insert into  `' + targetTable + '` select*from `' + targetTable + '_tmp` where ' + keyWord + '="' + item[keyWord] + '"';
	connection.query(insertSql, function(err, rows, fields) {
		if (err) throw err;
		callback(null, null);
	});
}
//同步错误表
function updateErrorTable(item, callback) {
	var insertSql = 'insert into  `' + targetTable + '_error` select*from `' + targetTable + '_tmp` where ' + keyWord + '="' + item[keyWord] + '"';
	connection.query(insertSql, function(err, rows, fields) {
		if (err) {
			console.log(err)
		}
		if (callback) {
			callback(null, null);
		}
	});
}
//更新同步AccessToken
function updateAccessToken(token, time, callback, type) {
	connection.query('UPDATE ' + config.tableFirstName + '_accesstoken SET accesstoken = ?,creattime = ?', [token, time], function(err, rows, fields) {
		if (err) throw err;
		if (type && type == 'first') {
			getAllWechatMembers(callback);
		} else {
			callback(null, null);
		}
	});
}

//获取企业微信所有的成员
function getAllWechatMembers(callback) {
	var url = 'https://qyapi.weixin.qq.com/cgi-bin/user/simplelist?access_token=' + global.access_token + '&department_id=1&fetch_child=1';
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
			if (resultObj.errcode == 0) {
				console.log('获取所有人员---------------------------------\r\n');
				console.log(resultObj.userlist);
				var allWechatMembers = [];
				resultObj.userlist.forEach(function(item) {
					if (lodash.indexOf(config.whiteID, item.userid) == -1) {
						allWechatMembers.push(item.userid);
					}
				});
				deleteAllWechatMembers({
					useridlist: allWechatMembers
				}, callback);
			} else {
				callback(null, null);
				console.log('errmsg:' + resultObj.errmsg);
			}
		});
	}).on("error", function(err) {
		console.log(err)
		callback(null, null);
	});
}
//删除企业微信所有的成员
function deleteAllWechatMembers(arr, callback) {
	var infoPerson = arr;
	//如果没有需要删除的成员
	if (infoPerson.useridlist.length != 0) {
		var postData = JSON.stringify(infoPerson);
		var options = {
			host: 'qyapi.weixin.qq.com',
			path: '/cgi-bin/user/batchdelete?access_token=' + global.access_token,
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				'Content-Length': Buffer.byteLength(postData)
			}
		};
		console.log('正在删除企业微信上已经存在的成员~');
		var req = https.request(options, function(res) {
			res.setEncoding('utf-8');
			var datas = [];
			var size = 0;
			res.on('data', function(chun) {
				var resultObj = JSON.parse(chun);
				if (resultObj.errcode == 0) {
					//获取组织架构了
					getAllOldNodes(callback);
				} else if (resultObj.errcode != 48002) {
					console.log('删除成员失败');
					console.log('errmsg:' + resultObj.errmsg + ' errcode:' + resultObj.errcode);
					callback(null, null);
				} else if (resultObj.errcode == 48002) {
					console.log('API接口无权限调用，请在企业微信管理后台设置通讯录同步权限！');
				}
			});
			res.on('end', function() {});
		});
		req.on('error', function(err) {
			console.error(err);
			callback(null, null);
		});
		req.write(postData);
		req.end();
	} else {
		getAllOldNodes(callback);
	}
}
//获取企业微信上已经存在的组织架构
function getAllOldNodes(callback) {
	var url = 'https://qyapi.weixin.qq.com/cgi-bin/department/list?access_token=' + global.access_token + '&id=1';
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
			if (resultObj.errcode == 0) {
				allOldOrganization = resultObj.department;
				console.log('正在删除企业微信上已经存在的组织架构~\r\n');
				findSubNode(allOldOrganization, callback);
			} else {
				callback(null, null);
			}
		});
	}).on("error", function(err) {
		console.log(err)
		callback(null, null);
	});
}
//递归是否有子部门
function findSubNode(arr, callback) {
	var parentid = arr[0].parentid;
	async.forEachOf(arr, function(item, key, eachCallback) {
		var targetIdArray = lodash.filter(allOldOrganization, function(n) {
			return n.parentid == item.id;
		});
		if (targetIdArray && targetIdArray.length > 0) {
			findSubNode(targetIdArray, eachCallback);
		} else {
			//删除无子节点的节点
			deleteTargetDepartment(item.id, eachCallback);
		}
	}, function(err) {
		if (err) {
			console.log(err);
		}
		if (parentid > 1) {
			//子节点删除后，删除父节点
			deleteTargetDepartment(parentid, callback);
			console.log('正在删除id为' + parentid + '的节点');
		} else {
			callback(null, null);
		}
	});
}
//删除指定部门
function deleteTargetDepartment(id, callback) {
	var url = 'https://qyapi.weixin.qq.com/cgi-bin/department/delete?access_token=' + global.access_token + '&id=' + id;
	https.get(url, function(res) {
		var datas = [];
		var size = 0;
		res.on('data', function(data) {
			datas.push(data);
			size += data.length;
			var buff = Buffer.concat(datas, size);
			var result = buff.toString();
			var resultObj = JSON.parse(result);
			if (resultObj.errcode == 0) {
				//console.log('deleteTargetDepartment---------------------success------------\r\n');
			} else if (resultObj.errcode != 48002) {
				//console.log('deleteTargetDepartment---------------------fail------------\r\n');
			} else if (resultObj.errcode == 48002) {
				console.log('API接口无权限调用，请在企业微信管理后台设置通讯录同步权限！');
			}
			callback(null, null);
		});
		res.on("end", function() {});
	}).on("error", function(err) {
		console.log(err)
		callback(null, null);
	});
}
/*-------------------------------------------sync address  end----------------------------------------*/