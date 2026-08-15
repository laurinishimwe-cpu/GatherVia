import httpx

async def verify_google_access_token(access_token: str) -> dict:
    """
    Verify the Google access token and return the user's email and name.
    Calls the Google UserInfo endpoint, which also validates the token.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if resp.status_code != 200:
            raise ValueError("Invalid Google access token")

        data = resp.json()

        email = data.get("email")
        if not email:
            raise ValueError("UserInfo did not return an email")

        name = data.get("name")
        if not name:
            raise ValueError("UserInfo did not return a name")

        return {
            "email": email,
            "full_name": name,
        }