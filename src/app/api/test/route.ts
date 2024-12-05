import { NextResponse } from "next/server";
import { twitterClient } from "@/lib/clients/twitter";

// export const runtime = "edge";

export async function GET() {
  // This is a test endpoint - should only be available in development
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not available in production", { status: 403 });
  }

  try {
    // Create a tweet using the authenticated client
    const tweet = await twitterClient.v2.tweet(
      "Hello world! This is a test tweet from my bot 🤖"
    );

    return NextResponse.json({
      success: true,
      tweet: tweet.data,
    });
  } catch (error) {
    console.error("Tweet creation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create tweet",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not available in production", { status: 403 });
  }

  try {
    const body = await request.json();
    const { pin, oauth_token, oauth_token_secret } = body;

    // Login with the temporary tokens and PIN
    const { accessToken, accessSecret } = await twitterClient.login(
      pin,
      oauth_token,
      oauth_token_secret
    );

    return NextResponse.json({
      success: true,
      message: "Successfully authenticated",
      // These are the tokens you want to save
      accessToken,
      accessSecret,
    });
  } catch (error) {
    console.error("PIN verification error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to verify PIN",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
