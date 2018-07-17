import React, { Component } from 'react';
import { Alert, AsyncStorage, Platform, StyleSheet, Text, View, Linking } from 'react-native';
import { CLIENT_ID, REDIRECT_URI, BASE_URL, AUTHORIZE_URL, TOKEN_URL, CODE_VERIFIER, CODE_CHALLENGE, USERNAME, PASSWORD, OKTA_STATE_PARAM } from './ApiConstants';
import { parseUrl } from 'query-string';

import str2buf from 'str2buf';
import b64u from 'b64u-lite';
import crypto from 'isomorphic-webcrypto';
import * as util from './util';
import delve from 'dlv';
import * as packageJson from './package.json';


export default class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      userName: '',
      passsword: '',
      codeVerifier: CODE_VERIFIER,
      codeChallenge: CODE_CHALLENGE,
      userInfo: '',
      sessionToken: 'NO_SESSION_TOKEN',
      accessToken: 'NO_DATA',
      tokenInfo: 'NO_TOKEN_INFO',
      code: 'NO_CODE',
      errorCode: 'NO_ERROR_CODE',
      errorSummary: 'NO_ERROR_SUMMERY',
      error: 'NO_ERROR',
      errorDescription: 'NO_ERROR_DESCRIPTION',
      responseJson: {
        _embedded: {
          user: {
            profile: {
              login: 'NOT_LOGGED_IN'
            }
          }
        }
      }
    };
  }


  componentDidMount = async () => {

    try {
      // Create the PKCE requirements
      await crypto.ensureSecure();
      const { code_verifier, code_challenge } = await this.createPKCEParams();
      console.log('codeVerifier : ' + code_verifier);
      console.log('codeChallenge : ' + code_challenge);
      this.setState({
        codeVerifier: code_verifier,
        codeChallenge: code_challenge
      });


      let config = {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          username: USERNAME,
          password: PASSWORD
        }),
      };

      let response = await fetch(BASE_URL + '/api/v1/authn', config);
      console.log(response);
      if (response.status === 200) {
        let responseJson = await response.json();
        //console.log(responseJson);
        if (responseJson.status !== undefined) {
          this.setState({
            responseJson: responseJson,
            sessionToken: responseJson.sessionToken,
            isLoading: false,
          });
          await this.getAuthorizationCode(responseJson.sessionToken);
        }
      } else {
        console.log("something went wrong");
        Alert.alert('Log In Failed, Please try again! ');
      }
    } catch (error) {
      console.error(error);
    }

  }


  getAuthorizationCode = async (sessionToken) => {
    try {
      let authUri = 'client_id=' + CLIENT_ID + '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) + '&response_type=code&state=' + OKTA_STATE_PARAM + '&sessionToken=' + sessionToken + '&scope=openid%20email&code_challenge_method=S256&code_challenge=' + this.state.codeChallenge;

      let response = await fetch(AUTHORIZE_URL + authUri);
      console.log(response);

      let callBackUrl = response.headers.get("Location");

      if (callBackUrl !== null) {
        let parsedUrlInfo = parseUrl(callBackUrl);
        this.setState({
          tokenInfo: callBackUrl,
          code: parsedUrlInfo.query.code
        });
        await this.getAccessToken(parsedUrlInfo.query.code);
      } else {
        console.log('getAuthorizationCode :');
        console.log(response.json());
      }

    } catch (error) {
      console.error(error);
    }
  }

  getAccessToken = async (authorizationCode) => {
    try {

      let config = {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache'
        },
        body: util.urlFormEncode({
          grant_type: 'authorization_code',
          client_id: CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          code: authorizationCode,
          code_verifier: this.state.codeVerifier
        })
      };

      let response = await fetch(TOKEN_URL, config);
      console.log(response);
      Alert.alert(response.status.toString());

      //check if it is returning OK status
      if (response.status === 200) {
        let responseJson = await response.json();
        if (responseJson.access_token !== undefined) {

          this.setState({
            accessToken: responseJson.access_token
          });

        } else {
          console.log(responseJson.errorCode);
          console.log(responseJson.errorSummary);
          console.log("something went wrong");
          Alert.alert('Log In Failed, Please try again! ');
        }
      }

      if (response.status === 400) {
        let responseJson = await response.json();
        console.log(responseJson.error);
        console.log(responseJson.error_description);
        console.log(responseJson.errorCode);
        console.log(responseJson.errorSummary);

        this.setState({
          error: responseJson.error,
          errorDescription: responseJson.error_description,
          errorCode: responseJson.errorCode,
          errorSummary: responseJson.errorSummary,
        });

      }

      if (response.status === 403) {
        console.log(response.text());
      }

    } catch (error) {
      console.error(error);
    }
  }



  createPKCEParams = async () => {
    const code_verifier = util.createRandomString(43);
    const code_challenge_buffer = await crypto.subtle.digest({ name: "SHA-256" }, code_verifier);
    const code_challenge = b64u.fromBinaryString(str2buf.fromBuffer(code_challenge_buffer));
    return {
      code_verifier,
      code_challenge
    };
  }


  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>
          User :{this.state.responseJson._embedded.user.profile.login}
        </Text>
        <Text style={styles.instructions}>
          SessionToken : {this.state.responseJson.sessionToken}
        </Text>
        <Text style={styles.instructions}>
          AccessToken : {this.state.accessToken}
        </Text>
        <Text style={styles.instructions}>
          Location : {this.state.tokenInfo}
        </Text>
        <Text style={styles.instructions}>
          Code : {this.state.code}
        </Text>
        <Text style={styles.instructions}>
          Error : {this.state.error}
        </Text>
        <Text style={styles.instructions}>
          Error_Description : {this.state.errorDescription}
        </Text>
        <Text style={styles.instructions}>
          Error Code : {this.state.errorCode}
        </Text>
        <Text style={styles.instructions}>
          Error_Summery : {this.state.errorSummary}
        </Text>
        <Text style={styles.instructions}>
          codeVerifier : {this.state.codeVerifier}
        </Text>
        <Text style={styles.instructions}>
          codeChallenge : {this.state.codeChallenge}
        </Text>

      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
});
