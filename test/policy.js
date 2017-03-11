"use strict";

var assert = require('assert');
var policy = require('../lib/policy.js')();
var YAML = require('yamljs');
var fs = require('fs');
var defaultPolicy = YAML.load('./default_policy.yaml');

it('succeeds with an empty policy',
function() {
  var testPolicy = {}
  var testContainer = {};

  var result = policy.execute(testPolicy, testContainer);
  assert(result.isPassing());

  // Ensure message count matches test count
  assert(policy.enumerateTests.length === result.getMessages.length);
});

it('fails with violations of the default policy',
function() {

  var testPolicy = defaultPolicy;
  var testContainer = JSON.parse(fs.readFileSync(__dirname + '/fixtures/failing_default.json', 'utf8'))[0];
  var result = policy.execute(testPolicy, testContainer);

  assert(!result.isPassing());

  // Ensure message count matches test count
  assert(policy.enumerateTests().length === result.getMessages().length);
});

it('succeeds without disallowed labels',
function() {
  var testPolicy = { labels: { disallow: ['com.swipely.iam-docker.iam-profile', 'ABCDEF'] }};
  var testContainer = { Config: { Labels: { OTHER_ROLE: 12345}}};

  var result = policy.validateLabels(testPolicy, testContainer, policy.msgs());
  assert(result);
});

it('fails with disallowed labels',
function() {
  var testPolicy = { labels: { disallow: ['ABCDEF', 'com.swipely.iam-docker.iam-profile']}};
  var testContainer = { Config: { Labels: { 'com.swipely.iam-docker.iam-profile': 12345}}};

  var result = policy.validateLabels(testPolicy, testContainer, policy.msgs());
  assert(!result);
});

it('succeeds without disallowed env keys',
function() {

  var testPolicy = { labels: { disallow: ['IAM_ROLE', 'ABCDEF'] }};
  var testContainer = { Config: { Env: ['OTHER_ROLE=12345', 'OTHER_OTHER_ROLE=67890']}};

  var result = policy.validateEnvKeys(testPolicy, testContainer, policy.msgs());
  assert(result);
});

it('fails with disallowed env keys',
function() {

  var testPolicy = { env_keys: { disallow: ['IAM_ROLE', 'ABCDEF'] }};
  var testContainer = { Config: { Env: ['IAM_ROLE=12345']}};

  var result = policy.validateEnvKeys(testPolicy, testContainer, policy.msgs());
  assert(!result);
});

it('succeeds with volumes, default volume restriction (none)',
function() {
  var testPolicy = {};
  var testContainer = { Config: { Volumes: { '/myvolume': {}, '/another-volume': {}}}};

  var result = policy.validateVolumes(testPolicy, testContainer, policy.msgs());
  assert(result);
});

it('succeeds without volumes, without restrictions',
function() {
  var testPolicy = { volumes: { disallowed: false }};
  var testContainer = { Config: { Volumes: {}}};

  var result = policy.validateVolumes(testPolicy, testContainer, policy.msgs());
  assert(result);
});

it('succeeds with volumes, without restrictions',
function() {
  var testPolicy = { volumes: { disallowed: false }};
  var testContainer = { Config: { Volumes: { '/myvolume': {}, '/another-volume': {}}}};

  var result = policy.validateVolumes(testPolicy, testContainer, policy.msgs());
  assert(result);
});

it('succeeds without volumes, with restrictions',
function() {
  var testPolicy = { volumes: { disallowed: true }};
  var testContainer = { Config: { Volumes: {}}};

  var result = policy.validateVolumes(testPolicy, testContainer, policy.msgs());
  assert(result);
});

it('fail with volumes, with restrictions',
function() {
  var testPolicy = { volumes: { disallowed: true }};
  var testContainer = { Config: { Volumes: { '/myvolume': {}, '/another-volume': {}}}};

  var result = policy.validateVolumes(testPolicy, testContainer, policy.msgs());
  assert(!result);
});

it('succeeds without ports, without requirement',
function() {
  var testPolicy = { ports: { required: false }};
  var testContainer = {};

  var result = policy.validatePortRequirement(testPolicy, testContainer, policy.msgs());
  assert(result);
});

it('fails without ports, with requirement',
function() {
  var testPolicy = { ports: { required: true }};
  var testContainer = {};

  var result = policy.validatePortRequirement(testPolicy, testContainer, policy.msgs());
  assert(!result);
});

it('succeeds with ports, with requirement',
function() {
  var testPolicy = { ports: { required: true }};
  var testContainer = { ContainerConfig: { ExposedPorts: { '8080/tcp': {}, '8081/tcp': {}}}};

  var result = policy.validatePortRequirement(testPolicy, testContainer, policy.msgs());
  assert(result);
});

it('succeeds with ports, without requirement',
function() {
  var testPolicy = { ports: { required: false }};
  var testContainer = { ContainerConfig: { ExposedPorts: { '8080/tcp': {}, '8081/tcp': {}}}};

  var result = policy.validatePortRequirement(testPolicy, testContainer, policy.msgs());
  assert(result);
});

it('succeeds with ports, without range requirement',
function() {
  var testPolicy = { ports: { range: null }};
  var testContainer = { ContainerConfig: { ExposedPorts: { '8080/tcp': {}, '8081/tcp': {}}}};

  var result = policy.validatePortRange(testPolicy, testContainer, policy.msgs());
  assert(result);
});

it('succeeds with ports, within range requirement',
function() {
  var testPolicy = { ports: { range: '1-8082' }};
  var testContainer = { ContainerConfig: { ExposedPorts: { '8080/tcp': {}, '8081/tcp': {}}}};

  var result = policy.validatePortRange(testPolicy, testContainer, policy.msgs());
  assert(result);
});

it('fails with ports, with an invalid port range',
function() {
  var testPolicy = { ports: { range: '8081-8080' }};
  var testContainer = { ContainerConfig: { ExposedPorts: { '8080/tcp': {}, '8081/tcp': {}}}};

  var result = policy.validatePortRange(testPolicy, testContainer, policy.msgs());
  assert(!result);
});

// NOTE: this is correct, since a required port is part of validatePortRequirement
it('succeeds without a port, with of port range',
function() {
  var testPolicy = { ports: { range: '1-100' }};
  var testContainer = { ContainerConfig: { ExposedPorts: {}}};

  var result = policy.validatePortRange(testPolicy, testContainer, policy.msgs());
  assert(result);
});

it('fails with a port, outside of port range',
function() {
  var testPolicy = { ports: { range: '1-100' }};
  var testContainer = { ContainerConfig: { ExposedPorts: { '101/tcp': {}}}};

  var result = policy.validatePortRange(testPolicy, testContainer, policy.msgs());
  assert(!result);
});

it('fails with ports, one outside of port range',
function() {
  var testPolicy = { ports: { range: '1-100' }};
  var testContainer = { ContainerConfig: { ExposedPorts: { '50/tcp': {}, '101/tcp': {}}}};

  var result = policy.validatePortRange(testPolicy, testContainer, policy.msgs());
  assert(!result);
});

it('fails with ports, both outside of port range',
function() {
  var testPolicy = { ports: { range: '1-100' }};
  var testContainer = { ContainerConfig: { ExposedPorts: { '101/tcp': {}, '102/tcp': {}}}};

  var result = policy.validatePortRange(testPolicy, testContainer, policy.msgs());
  assert(!result);
});

it('succeeds at max size limit',
function() {
  var testPolicy = { size: { max: '10' }};
  var testContainer = { Size: 10000000};

  var result = policy.validateContainerSize(testPolicy, testContainer, policy.msgs());
  assert(result);
});

it('fails over max size limit',
function() {
  var testPolicy = { size: { max: '10' }};
  var testContainer = { Size: 10000001 };

  var result = policy.validateContainerSize(testPolicy, testContainer, policy.msgs());
  assert(!result);
});

it('fails when warning >= max size',
function() {
  var testPolicy = { size: { max: 10, warning: 11 }};
  var testContainer = { Size: 10000000 };
  var msgs = policy.msgs();
  var result = policy.validateContainerSize(testPolicy, testContainer, msgs);

  assert(!result);
});

it('succeeds over warning, but under max size limit',
function() {
  var testPolicy = { size: { max: 10, warning: 5 }};
  var testContainer = { Size: 5000001};
  var msgs = policy.msgs();
  var result = policy.validateContainerSize(testPolicy, testContainer, msgs);

  // Ensure there is only a single message in the stack
  assert(msgs.messages.length === 1);

  // Ensure that single message is a warning
  assert(msgs.messages.shift()[0] === 'warning');
  assert(result);
});

it('succeeds over warning, with no max size limit',
function() {
  var testPolicy = { size: { warning: 5 }};
  var testContainer = { Size: 5000001};
  var msgs = policy.msgs();
  var result = policy.validateContainerSize(testPolicy, testContainer, msgs);

  // Ensure there is only a single message in the stack
  assert(msgs.messages.length === 1);

  // Ensure that single message is a warning
  assert(msgs.messages.shift()[0] === 'warning');
  assert(result);
});