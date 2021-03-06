import * as _ from 'underscore';
import * as React from 'react';
import * as Backbone from 'backbone';
const moment = require('moment');
import { Doughnut } from 'react-chartjs';
import {
  Col, Row, Panel, PanelGroup, Table, Well, ControlLabel, FormControl,
  InputGroup, Button
} from 'react-bootstrap';
const Gravatar = require('react-gravatar');
import Equalizer from 'react-equalizer';
const Hashids = require('hashids');
const hashids = new Hashids();
const FontAwesome = require('react-fontawesome');
const TermsCollection = require('../collections/TermsCollection');
const UserAccountComponent = require('./UserAccountComponent');
const UserModalComponent = require('./UserModalComponent');
const UserReviewComponent = require('./UserReviewComponent');
const GradeModel = require('../models/GradeModel');
const reviews = require('../data/reviews');
const socials = require('../data/social');
const utils = require('../utils');

module.exports = React.createBackboneClass({
  getInitialState() {
    return {
      showModal: false,
      user: this.getModel(),
      activeKey: this.getModel().currentCourse().id,
      keyOpacity: 0
    }
  },

  close() {
    this.setState({ showModal: false });
  },

  open(e) {
    e.preventDefault();
    this.setState({
      showModal: true,
    });
  },

  checkIn(date) {
    $.ajax('/api/users/attendance', {
      method: 'post',
      data: {
        idn: this.getModel().get('idn'),
        date: date
      },
      success: () => {
        this.getModel().fetch();
      }
    });
  },

  changeAttendance(e) {
    e.preventDefault();
    const date = e.currentTarget.getAttribute('data-date');
    if (this.props.currentUser.get('is_admin') || this.props.currentUser.get('is_instructor')) {
      this.checkIn(date);
    } else if (moment(date, 'YYYY-MM-DD HH:mm').isSame(moment(), 'day')) {
      const code = prompt('Enter Daily Attendance Code');
      const hash = hashids.encode(Number(moment().format('YYYY-MM-DD').split('-').join(''))).slice(0, 4).toUpperCase();
      if (code && code.toUpperCase() === hash) {
        this.checkIn(date);
      }
    }
  },

  showKey(e) {
    e.preventDefault();
    this.setState({ keyOpacity: 1 });
  },

  generateApiKey(e) {
    e.preventDefault();
    this.getModel().save({
      generate_api_key: true
    }, {
      success: () => {
        if (this.getModel().id === this.props.currentUser.id) {
          this.props.currentUser.set('api_key', this.getModel().get('api_key'));
        }
      }
    });
    this.getModel().unset('generate_api_key', { silent: true });
  },

  handleSelect(activeKey) {
    this.setState({ activeKey });
  },

  submitUrl(e) {
    e.persist();
    const course = this.getModel().get('courses').get(e.target.getAttribute('data-course-id'));
    const grade = new GradeModel();
    grade.save({
      userId: this.getModel().id,
      name: e.target.getAttribute('data-grade-name'),
      url: e.target.value,
      courseId: course.id
    }, {
      success: () => {
        this.getModel().fetch();
      },
      error: () => {
        this.getModel().fetch();
      }
    });
  },

  render() {
    const key = utils.campusKey(this.getModel());
    const courses = this.getModel().get('courses').map((course, i) => {
      const dates = course.classDates().map((date, j) => {
        let attended = <FontAwesome name="calendar-o" />;
        let matched;
        let checkin;
        const video = _.findWhere(course.get('videos'), { timestamp: date.format('YYYY-MM-DD') });
        if (date.isSameOrBefore(moment(), 'day')) {
          attended = <FontAwesome name="calendar-times-o" className="text-danger" />
          matched = _.find(this.getModel().get('attendance'), (attendedDate) => {
            return moment(attendedDate, 'YYYY-MM-DD HH:mm').isSame(date, 'day');
          });
          if (matched) {
            attended = <FontAwesome name="calendar-check-o" className="text-success" onClick={this.changeAttendance} data-date={date.format('YYYY-MM-DD HH:ss')} />;
            checkin = <span>Present</span>;
          }  else {
            checkin = <span>Absent</span>;
          }
        }
        if (
          !matched &&
          (date.isSame(moment(), 'day') ||
            (this.props.currentUser.roles().some(role => ['instructor', 'admin'].includes(role)) && date.isSameOrBefore(moment(), 'day'))
          )
        ) {
          checkin = <a href="#" onClick={this.changeAttendance} data-date={date.format('YYYY-MM-DD HH:ss')}>Check In</a>;
        }
        return (
          <tr key={`${i}-${j}`}>
            <td>{date.format("ddd, MMM D")}</td>
            <td>{attended} {checkin}</td>
            <td>
              { video ?
                <a href={video.link} target="_blank">
                  <FontAwesome name="youtube-play" />
                  &nbsp; Watch
                </a>
                : '' }
            </td>
          </tr>
        );
      });

      const grades = course.get('grades').map(courseGrade => {
        const studentGrade = this.getModel().get('grades').find(studentGrade => {
          return studentGrade.name === courseGrade.name && studentGrade.courseId === course.id;
        }) || {};
        return (
          <tr key={courseGrade.name}>
            <td>{courseGrade.name}</td>
            <td>{courseGrade.checkpoint ? 'CP' : 'D'}</td>
            <td className={'score'+ studentGrade.score}>{_.isNumber(studentGrade.score) ? studentGrade.score : ''}</td>
            <td>
              {courseGrade.dueDate ? moment(courseGrade.dueDate, 'YYYY-MM-DD').format('ddd, MMM D') : ''}
            </td>
            <td>
              <small>
                <InputGroup>
                  <FormControl
                    type="text"
                    defaultValue={studentGrade.url}
                    placeholder="http://example.com"
                    onBlur={this.submitUrl}
                    data-course-id={course.id}
                    data-grade-name={courseGrade.name}
                  />
                  <InputGroup.Button>
                    {studentGrade.url ?
                      <Button href={studentGrade.url} target="_blank">
                        <FontAwesome name="external-link"/>
                      </Button>
                      :
                      <Button disabled={true}>
                        <FontAwesome name="times"/>
                      </Button>
                    }
                  </InputGroup.Button>
                </InputGroup>
              </small>
            </td>
          </tr>
        );
      });
      return (
        <Panel
          key={course.id}
          header={
            <h3>
              {course.get('name')}
              <small className="pull-right">
                {course.get('term').get('name')}
              </small>
            </h3>
          }
          footer={this.state.activeKey === course.id ?
            <small>
              D: Daily Grades are weighted 30% and are checked for completion;
              CP: Checkpoints are weighted 70% and are checked for a deeper
              understanding of the content
            </small>
            :
            ''
          }
          eventKey={course.id}
        >
          <Row>
            <Col xs={12} md={6}>
              <h4 className="text-center">Details</h4>
              <Well bsSize="small">
                <Row>
                  <Col xs={6}>
                    <p>
                      <ControlLabel>Textbook</ControlLabel>
                      <br />
                      <a href={course.get('textbook').get('student_url')} target="_blank">
                        <FontAwesome name="book" fixedWidth={true} />
                        &nbsp; {course.get('textbook').get('name')}
                      </a>
                    </p>
                    <p>
                      <ControlLabel>Virtual Classroom</ControlLabel>
                      <br />
                      <a href={'https://jitsi.austincodingacademy.com/' + hashids.encode([moment.utc(course.get('createdAt')).unix(), moment().format('MMDDYYYY')])} target="_blank">
                        <FontAwesome name="video-camera" fixedWidth={true} />
                        &nbsp; Enter Room
                      </a>
                      <br />
                      <small>
                        <a
                          href="https://chrome.google.com/webstore/detail/aca-desktop-streamer/imnhhcdlfbbhajjgbagfagnjgkmfppcg"
                          target="_blank"
                        >
                          <FontAwesome name="info-circle" fixedWidth={true} />
                          &nbsp; Screenshare
                        </a>
                      </small>
                    </p>
                    <p>
                      <ControlLabel>Class Times</ControlLabel>
                      <br />
                      {course.shortDays()}
                      <br />
                      {`${moment(course.get('timeStart'), 'HH:mm').format('h:mm a')} - ${moment(course.get('timeEnd'), 'HH:mm').format('h:mm a')}`}
                    </p>
                  </Col>
                  <Col xs={6}>
                    <p>
                      <ControlLabel>Address</ControlLabel>
                      <br />
                      <a href={course.get('location').link()} target="_blank">
                        <strong>{course.get('location').get('name')}</strong>
                        <br />
                        {course.get('location').get('address')}
                        <br />
                        {`${course.get('location').get('city')}, ${course.get('location').get('state')}`}
                      </a>
                    </p>
                    <p>
                      <ControlLabel>Special Note</ControlLabel>
                      <br />
                      {course.get('location').get('note')}
                    </p>
                  </Col>
                </Row>
              </Well>
            </Col>
            <Col xs={6} md={3}>
              <h4 className="text-center">Attendance</h4>
              <h4 className={`score${this.getModel().courseAttendance(course)} text-center`}>
                {this.getModel().courseAttendance(course)}%
              </h4>
              <p aria-hidden="true" className="center-align">
                <Doughnut
                  data={this.getModel().averageChartData(this.getModel().courseAttendance(course)).data}
                  options={this.getModel().averageChartData(this.getModel().courseAttendance(course)).options}
                />
              </p>
            </Col>
            <Col xs={6} md={3}>
              <h4 className="text-center">Grade Average</h4>
              <h4 className={`score${this.getModel().courseGrade(course)} text-center`}>
                {this.getModel().courseGrade(course)}%
              </h4>
              <p aria-hidden="true" className="center-align">
                <Doughnut
                  data={this.getModel().averageChartData(this.getModel().courseGrade(course)).data}
                  options={this.getModel().averageChartData(this.getModel().courseGrade(course)).options}
                />
              </p>
            </Col>
          </Row>
          <Row>
            <Col xs={12} md={4}>
              <h4 className="text-center">Attendance</h4>
              <Table striped>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Attended</th>
                    <th>Screencast</th>
                  </tr>
                </thead>
                <tbody>
                  {dates}
                </tbody>
              </Table>
            </Col>
            <Col xs={12} md={8}>
              <h4 className="text-center">Grades</h4>
              <Table striped>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Score</th>
                    <th>Due Date</th>
                    <th>Submit</th>
                  </tr>
                </thead>
                <tbody>
                  {grades}
                </tbody>
              </Table>
            </Col>
          </Row>
        </Panel>
      );
    });

    const hidden = this.props.currentUser.get('is_admin') || this.props.currentUser.id === this.getModel().id ? '' : ' hidden';

    let reviewCount = false;

    if (this.getModel().get('campus') && reviews[this.getModel().get('campus')]) {
      reviewCount = Object.keys(reviews[this.getModel().get('campus')]).filter(review => {
        return reviews[this.getModel().get('campus')][review].href;
      }).length + Object.keys(socials[this.getModel().get('campus')]).filter(social => {
        return socials[this.getModel().get('campus')][social].href;
      }).length;
    }

    return (
      <div>
        <Row>
          <Equalizer>
            <Col xs={12} md={6}>
              <Panel
                header={
                  <h3>
                    Profile
                    <a className={`${hidden} pull-right`} onClick={this.open} data-test="edit-profile">
                      <FontAwesome name="pencil" fixedWidth={true} />
                    </a>
                  </h3>
                }
              >
                <Row>
                  <Col xs={12}>
                    <h4>
                      <a
                        href="http://en.gravatar.com/"
                        target="_blank"
                        className="pull-left"
                        style={{marginRight: '1rem'}}
                      >
                        <Gravatar email={this.getModel().get('username')} protocol="https://" />
                      </a>
                      {this.getModel().get('first_name') + ' ' + this.getModel().get('last_name')}
                    </h4>
                  </Col>
                </Row>
                <br />
                <Row>
                  <Col xs={9}>
                    <p>
                      <FontAwesome name="envelope" fixedWidth={true} />
                      &nbsp;
                      <a href={'mailto:' + this.getModel().get('username')} target="_blank">
                        {this.getModel().get('username')}
                      </a>
                    </p>
                    <p>
                      <FontAwesome name="globe" fixedWidth={true} />
                      &nbsp;
                      <a title={'Website'} href={this.getModel().get('website')} target="_blank">
                        {this.getModel().get('website')}
                      </a>
                    </p>
                    <p>
                      <FontAwesome name="mobile" fixedWidth={true} />
                      &nbsp;
                      <a href={'tel:'+ this.getModel().get('phone')}>
                        {this.getModel().get('phone')}
                      </a>
                    </p>
                    <p>
                      <FontAwesome name="github" fixedWidth={true} />
                      &nbsp;
                      <a title={'GitHub Account'} href={'https://github.com/' + this.getModel().get('github')} target="_blank">
                        {this.getModel().get('github')}
                      </a>
                    </p>
                    <p>
                      <FontAwesome name="rocket" fixedWidth={true} />
                      &nbsp;
                      <a title={'Rocket Chat'} href={'https://chat.austincodingacademy.com/direct/' + this.getModel().get('rocketchat')} target="_blank">
                        {this.getModel().get('rocketchat') ? `@${this.getModel().get('rocketchat')}` : ''}
                      </a>
                    </p>
                    <p>
                      <FontAwesome name="code" fixedWidth={true} />
                      &nbsp;
                      <a title={'CodeAcademy Account'} href={'https://codecademy.com/' + this.getModel().get('codecademy')} target="_blank">
                        {this.getModel().get('codecademy')}
                      </a>
                    </p>
                    <p>
                      <FontAwesome name="map-marker" fixedWidth={true} />
                      &nbsp;
                      <a href={'https://maps.google.com/?q=' + this.getModel().get('zipcode')} target="_blank">
                        {this.getModel().get('zipcode')}
                      </a>
                    </p>
                  </Col>
                  <Col xs={3} className="text-center">
                    <div aria-hidden="true">
                      <h4 className={'score' + this.getModel().profileComplete()}>{this.getModel().profileComplete() + '%'}</h4>
                      <Doughnut data={this.getModel().averageChartData(this.getModel().profileComplete()).data} options={this.getModel().averageChartData(this.getModel().profileComplete()).options} />
                      <small>
                        Profile
                        <br />
                        Complete
                      </small>
                    </div>
                  </Col>
                </Row>
              </Panel>
            </Col>
            {this.getModel().get('is_admin') ?
            <Col xs={12} md={6}>
              <Panel header={<h3>Admin Tips</h3>}>
                <p>New User Registration can be found at</p>
                <small><pre>{`https://campus.${key}codingacademy.com/register/${this.getModel().get('client')}`}</pre></small>
                <p>Users can reset their password at</p>
                <small><pre>{`https://campus.${key}codingacademy.com/reset`}</pre></small>
                <p>Users can register on Rocket.Chat at</p>
                <small><pre>{process.env.ROCKET_CHAT}</pre></small>
                <p>Your API Key is</p>
                <small>
                  <pre>
                    <span style={{opacity: this.state.keyOpacity}}>
                      {this.getModel().get('api_key') || 'Click regenerate to generate a key'}
                    </span>
                  </pre>
                  <a href="#" className={this.state.keyOpacity ? 'hidden' : ''} onClick={this.showKey}>show</a>
                  <a href="#" className={this.state.keyOpacity ? '' : 'hidden'} onClick={this.generateApiKey}>regenerate</a>
                </small>
              </Panel>
            </Col>
            :
            ''
            }
            {this.getModel().get('courses').length ?
            <Col xs={6} md={3}>
              <Panel header={<h3>Overall Attendance</h3>}>
                <h4 className={`score${this.getModel().overallAttendance()} text-center`}>
                  {this.getModel().overallAttendance()}%
                </h4>
                <p aria-hidden="true" className="center-align">
                  <Doughnut
                    data={this.getModel().averageChartData(this.getModel().overallAttendance()).data}
                    options={this.getModel().averageChartData(this.getModel().overallAttendance()).options}
                  />
                </p>
              </Panel>
            </Col>
            : ''}
            {this.getModel().get('courses').length ?
            <Col xs={6} md={3}>
              <Panel header={<h3>Overall Grade Average</h3>}>
                <h4 className={`score${this.getModel().overallGrade()} text-center`}>
                  {this.getModel().overallGrade()}%
                </h4>
                <p aria-hidden="true">
                  <Doughnut
                    data={this.getModel().averageChartData(this.getModel().overallGrade()).data}
                    options={this.getModel().averageChartData(this.getModel().overallGrade()).options}
                  />
                </p>
              </Panel>
            </Col>
            : ''}
          </Equalizer>
          {this.getModel().get('is_student') ?
          <Col xs={12} md={6}>
            <UserAccountComponent
              model={this.getModel()}
              terms={this.props.terms}
              currentUser={this.props.currentUser}
            />
          </Col>
          :
          ''
          }
          {this.getModel().get('campus') && reviewCount ?
          <Col xs={12} md={6}>
            <UserReviewComponent model={this.getModel()} />
          </Col>
          :
          ''
          }
          <Col xs={12}>
            <PanelGroup activeKey={this.state.activeKey} onSelect={this.handleSelect} accordion>
              {courses}
            </PanelGroup>
          </Col>
        </Row>
        <UserModalComponent
          show={this.state.showModal}
          onHide={this.close}
          model={this.state.user}
          title='Edit Profile'
          currentUser={this.props.currentUser}
        />
      </div>
    );
  }
});
