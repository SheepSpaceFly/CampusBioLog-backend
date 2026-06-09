// src/middlewares/wechatAuth.js
const axios = require('axios');

const WECHAT_APP_ID = process.env.WECHAT_APP_ID;
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET;
const WECHAT_CODE2SESSION_URL = 'https://api.weixin.qq.com/sns/jscode2session';

/**
 * 微信 code2session 中间件
 * 必须传递 code，换取真实 openid 后挂载到 req.openid
 */
async function wechatCodeMiddleware(req, res, next) {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: '缺少微信登录凭证 code，请确保前端调用 wx.login 后传递 code'
    });
  }

  try {
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
      if (data.errcode === 40029) {
        return res.status(400).json({ success: false, message: 'code 无效或已过期，请重新登录' });
      }
      if (data.errcode === 45011) {
        return res.status(429).json({ success: false, message: '调用频率过高，请稍后重试' });
      }
      return res.status(500).json({ success: false, message: '微信登录服务异常' });
    }

    req.openid = data.openid;
    // session_key 可用于解密手机号等，可挂载到 req.session_key 供后续中间件使用（不返回前端）
    next();
  } catch (err) {
    console.error('请求微信接口失败:', err.message);
    return res.status(500).json({ success: false, message: '服务器内部错误，请稍后重试' });
  }
}

module.exports = wechatCodeMiddleware;