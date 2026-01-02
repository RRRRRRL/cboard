import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { Route, Switch, Redirect } from 'react-router-dom';
import classNames from 'classnames';

import Activate from '../Account/Activate';
import ChangePassword from '../Account/ChangePassword';
import OAuthLogin from '../Account/OAuthLogin';
import AuthScreen, { RedirectIfLogged } from '../AuthScreen';
import BoardContainer from '../Board';
import PremiumRequiredModal from '../PremiumFeature/PremiumRequiredModal';
import Notifications from '../Notifications';
import NotFound from '../NotFound';
import Settings from '../Settings';
import WelcomeScreen from '../WelcomeScreen';
import Analytics from '../Analytics';
import AdminDashboard from '../Admin/AdminDashboard';
import TeacherDashboard from '../Settings/Teacher/TeacherDashboard';
import ParentDashboard from '../Settings/Parent/ParentDashboard';
import AdminOrganizations from '../Admin/AdminOrganizations/AdminOrganizations.component';
import AdminUsers from '../Admin/AdminUsers/AdminUsers.component';
import AdminParentChild from '../Admin/AdminParentChild/AdminParentChild.component';
import './App.css';
import LoginRequiredModal from '../LoggedInFeature/LoginRequiredModal';

export class App extends Component {
  static propTypes = {
    /**
     * App language direction
     */
    dir: PropTypes.string.isRequired,
    /**
     * If 'true', user first visit
     */
    isFirstVisit: PropTypes.bool,
    /**
     * If 'true', user is logged in
     */
    isLogged: PropTypes.bool,
    /**
     * If 'true', user is downloading a new lang
     */
    isDownloadingLang: PropTypes.bool,
    /**
     * App language
     */
    lang: PropTypes.string.isRequired,
    /**
     * If 'true', dark mode is enabled
     */
    dark: PropTypes.bool
  };

  render() {
    const {
      lang,
      dir,
      isFirstVisit,
      isLogged,
      dark,
      isDownloadingLang
    } = this.props;

    return (
      <div className={classNames('App', { 'is-dark': dark })}>
        <Helmet>
          <html lang={lang} dir={dir} />
        </Helmet>

        <Notifications />
        <Switch>
          <RedirectIfLogged
            component={AuthScreen}
            isLogged={isLogged}
            path="/login-signup"
            to="/"
          />
          {/* Role-based dashboard routes - specific routes first */}
          <Route path="/admin/dashboard" component={AdminDashboard} />
          <Route path="/settings/admin" component={AdminDashboard} />
          <Route path="/admin/organizations/new" component={AdminOrganizations} />
          <Route path="/admin/organizations" component={AdminOrganizations} />
          <Route path="/admin/users" component={AdminUsers} />
          <Route path="/admin/parent-child" component={AdminParentChild} />
          <Route path="/teacher/dashboard" component={TeacherDashboard} />
          <Route path="/teacher/messages" component={TeacherDashboard} />
          <Route path="/teacher/students/:studentId/progress" component={TeacherDashboard} />
          <Route path="/settings/teacher" component={TeacherDashboard} />
          <Route path="/parent/dashboard" component={ParentDashboard} />
          <Route path="/parent/children/:childId/progress" component={ParentDashboard} />
          <Route path="/settings/parent" component={ParentDashboard} />

          <Route path="/settings" component={Settings} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/activate/:url" component={Activate} />
          <Route path="/reset/:userid/:url" component={ChangePassword} />
          <Route path="/login/:type/callback" component={OAuthLogin} />
          {/* 兼容舊網址：/board/:id 立即 302 到 /profile/:id */}
          <Route
            path="/board/:id"
            render={props => {
              const {
                match: { params },
                history
              } = props;
              const targetId = params.id;
              if (targetId) {
                history.replace(`/profile/${targetId}`);
              } else {
                history.replace('/');
              }
              return null;
            }}
          />
          {/* 主溝通頁：改用 profile 路徑，id 視為 profileId */}
          <Route path="/profile/:id" component={BoardContainer} />

          {isDownloadingLang && (
            <Route exact path={'/'}>
              <Redirect to={'/settings/language'} />
            </Route>
          )}
          <Route
            exact
            path="/"
            render={props =>
              isFirstVisit && !isLogged ? (
                <WelcomeScreen />
              ) : (
                <BoardContainer {...props} />
              )
            }
          />
          <Route component={NotFound} />
        </Switch>
        <PremiumRequiredModal />
        <LoginRequiredModal />
      </div>
    );
  }
}

export default App;
