import json

import requests
from django.conf import settings
from django.http import JsonResponse, HttpResponse, HttpResponseBadRequest
from django.shortcuts import render

from django.views import View
from requests import Response

from user.models import UserInfo
from utils.WXBizDataCrypt import WXBizDataCrypt


class WxLoginView(View):
    def post(self, request):
        post = request.POST
        code = post.get('code')
        if not code:
            return HttpResponse({'msg': 'missing parameter: code'}, status=HttpResponseBadRequest)

        url = "https://api.weixin.qq.com/sns/jscode2session?appid={0}&secret={1}&js_code={2}&grant_type=authorization_code" \
            .format(settings.WX_APP_ID, settings.WX_APP_KEY, code)
        # 发送GET请求
        wx_res = requests.get(url)

        errcode = wx_res['errcode'] if 'errcode' in wx_res else None
        if errcode:
            return HttpResponse({'msg': wx_res.errmsg}, status=503)
        res = json.loads(wx_res.text)
        # 解密 encryptedData
        data = post.get('data')
        iv = post.get('iv')
        if not all([data, iv]):
            return HttpResponse({'msg': 'missing parameter:  data or  iv'}, status=HttpResponseBadRequest)
        session_key = res['session_key'] if 'session_key' in res else None
        if not session_key:
            return HttpResponse({'msg': 'no session_key'}, status=503)
        pc = WXBizDataCrypt(settings.WX_APP_ID, session_key)
        wx_user = pc.decrypt(data, iv)
        unionid = wx_user['unionId']

        user = UserInfo.objects.get(wx_unionid=unionid)
        # 判断用户是否第一次登录
        if not user:
            # 微信用户第一次登录,新建用户
            nickname = wx_user['nickName']
            username = 'wx_' + nickname
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
                                           language=language)

        # 生成 token，省略……
        return JsonResponse({'uuid': unionid, 'token': unionid})
