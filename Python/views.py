import hashlib
import time
import json

import requests
from django.conf import settings
from django.http import JsonResponse
from django.views import View
from django_redis import get_redis_connection

from user.models import UserInfo
from utils.WXBizDataCrypt import WXBizDataCrypt


class WxLoginView(View):
    def post(self, request):
        post = request.POST
        code = post.get('code')
        if not code:
            return JsonResponse({'code': 10001, 'msg': 'missing parameter: code'})

        url = "https://api.weixin.qq.com/sns/jscode2session?appid={0}&secret={1}&js_code={2}&grant_type=authorization_code" \
            .format(settings.WX_APP_ID, settings.WX_APP_KEY, code)
        # 发送GET请求
        wx_res = requests.get(url)
        errcode = wx_res['errcode'] if 'errcode' in wx_res else None
        if errcode:
            return JsonResponse({'code': 13001, 'msg': 'wx_auth.code2Session:' + wx_res.errmsg})

        wx_session = json.loads(wx_res.text)
        unionid = wx_session['unionId'] if 'unionId' in wx_session else None
        decrypt = False
        user = None
        if not unionid:
            decrypt = True
        else:
            user = UserInfo.objects.get(wx_unionid=unionid)
            # 判断用户是否第一次登录
            if not user:
                decrypt = True
        # 解密 encryptedData
        if decrypt:
            encrypted_data = post.get('data')
            iv = post.get('iv')
            if not all([encrypted_data, iv]):
                return JsonResponse({'code': 10001, 'msg': 'missing parameter: data,iv'})

            session_key = wx_session['session_key'] if 'session_key' in wx_session else None
            if not session_key:
                return JsonResponse({'code': 13001, 'msg': 'wx_auth.code2Session:' + 'no session_key'})

            pc = WXBizDataCrypt(settings.WX_APP_ID, session_key)
            wx_user = pc.decrypt(encrypted_data, iv)
            unionid = wx_user['unionId']

            user = UserInfo.objects.get(wx_unionid=unionid)
            # 判断用户是否第一次登录
            if not user:
                # 微信用户第一次登录,创建用户
                username = 'wx_' + unionid
                nickname = wx_user['nickName']
                avatar = wx_user['avatarUrl']
                gender = wx_user['gender']
                country = wx_user['country']
                province = wx_user['province']
                city = wx_user['city']
                language = wx_user['language']
                user = UserInfo.objects.create(username=username,
                                               wx_unionid=unionid,
                                               nickname=nickname,
                                               avatar=avatar,
                                               gender=gender,
                                               country=country,
                                               province=province,
                                               city=city,
                                               language=language,
                                               )

        # 生成 token
        md5 = hashlib.md5()
        bstr = (unionid + str(time.time())).encode(encoding='utf-8')
        md5.update(bstr)
        token = md5.hexdigest()
        bstr = ("refresh" + unionid + str(time.time())).encode(encoding='utf-8')
        md5.update(bstr)
        refreshtoken = md5.hexdigest()
        # 存入Redis
        conn = get_redis_connection('default')
        conn.set(token, unionid)
        conn.expire(token, 5)
        conn.set(refreshtoken, unionid)
        conn.expire(refreshtoken, 3600 * 24 * 7)
        data = {'token': token, 'expire': 3600, 'refreshtoken': refreshtoken}
        return JsonResponse({'code': 10000, 'msg': 'ok', 'data': data})


class TokenCheckView(View):
    def post(self, request):
        post = request.POST
        token = post.get('token')
        if not token:
            return JsonResponse({'code': 10001, 'msg': 'missing parameter: token'})

        conn = get_redis_connection('default')
        exist = conn.ttl(token)
        if exist < 0:
            return JsonResponse({'code': 10200, 'msg': 'token expired'})
        else:
            return JsonResponse({'code': 10000, 'msg': 'ok'})


class TokenRefreshView(View):
    def post(self, request):
        post = request.POST
        refreshtoken = post.get('refreshtoken')
        if not refreshtoken:
            return JsonResponse({'code': 10001, 'msg': 'missing parameter: refreshtoken'})

        conn = get_redis_connection('default')
        unionid = conn.get(refreshtoken)
        if not unionid:
            return JsonResponse({'code': 10200, 'msg': 'refreshtoken expired'})

        # 生成 token
        md5 = hashlib.md5()
        bstr = unionid + str(time.time()).encode(encoding='utf-8')
        md5.update(bstr)
        token = md5.hexdigest()
        conn.set(token, unionid)
        conn.expire(token, 5)
        data = {'token': token}
        return JsonResponse({'code': 10000, 'msg': 'ok', 'data': data})
