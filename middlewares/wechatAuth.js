// src/middlewares/wechatAuth.js
const axios = require('axios');

const WECHAT_APP_ID = process.env.WECHAT_APP_ID;
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET;
const WECHAT_CODE2SESSION_URL = 'https://api.weixin.qq.com/sns/jscode2session';

/**
 * 通过 code 换取微信 openid（核心函数，可复用）
 * @param {string} code - 微信小程序 wx.login 获得的临时凭证
 * @returns {Promise<string>} 返回真实 openid
 * @throws {Error} 微信接口调用失败时抛出错误，错误对象包含 statusCode 和 message
 */
async function getOpenidByCode(code) {
  const response = await axios.get(WECHAT_CODE2SESSION_URL, {
    params: {
      appid: WECHAT_APP_ID,
      secret: WECHAT_APP_SECRET,
      js_code: code,
      grant_type: 'authorization_code',
    },
  });

  const data = response.data;
  if (data.errcode) {
    console.error('微信 code2session 失败:', data);
    const error = new Error(data.errmsg || '微信登录服务异常');
    error.errcode = data.errcode;
    throw error;
  }
  return data.openid;
}

/**
 * 微信 code2session 中间件
 * 从 req.body.code 换取 openid，挂载到 req.openid，然后 next()
 * 如果 code 无效或缺失，直接返回错误响应
 */
async function wechatCodeMiddleware(req, res, next) {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({
      success: false,
      message: '缺少微信登录凭证 code，请确保前端调用 wx.login 后传递 code',
    });
  }

  try {
    const openid = await getOpenidByCode(code);
    req.openid = openid;
    next();
  } catch (err) {
    if (err.errcode === 40029) {
      return res.status(400).json({ success: false, message: 'code 无效或已过期，请重新登录' });
    }
    if (err.errcode === 45011) {
      return res.status(429).json({ success: false, message: '调用频率过高，请稍后重试' });
    }
    return res.status(500).json({ success: false, message: err.message || '服务器内部错误' });
  }
}

module.exports = {
  wechatCodeMiddleware,
  getOpenidByCode, // 导出供其他模块使用
};