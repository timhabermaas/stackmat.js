const path = require('path');
const del = require('del');
const gulp = require('gulp');
const gutil = require('gulp-util');
const coffeelint = require('gulp-coffeelint');
const coffee = require('gulp-coffee');
const header = require('gulp-header');
const sourcemaps = require('gulp-sourcemaps');
const connect = require('gulp-connect');
const gulpNSP = require('gulp-nsp');
const karma = require('karma');
const pkg = require('./package.json');

const paths = {
  src: 'src',
  dist: 'build',
  example: 'example',
  demo: 'docs'
};

const banner = ['/**',
  ' * <%= pkg.name %> - <%= pkg.description %>',
  ' * @version v<%= pkg.version %> - <%= date %>',
  ' * @link <%= pkg.homepage %>',
  ' * @license <%= pkg.license %>',
  ' */',
  ''
].join('\n');

function clean() {
  return del([`./${paths.dist}`]);
}

function buildCoffee(dest) {
  gulp.src(`./${paths.src}/*.coffee`)
    .pipe(coffeelint())
    .pipe(coffeelint.reporter())
    .pipe(sourcemaps.init())
    .pipe(coffee({
      bare: false
    }).on('error', gutil.log))
    .pipe(header(banner, {
      pkg: pkg,
      date: new Date()
    }))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(dest));
}

function build() {
  buildCoffee(`./${paths.dist}/`);
}

function runTests(singleRun, done) {

  const localConfig = {
    configFile: path.join(__dirname, './karma.conf.coffee'),
    singleRun: singleRun,
    autoWatch: !singleRun
  };

  const server = new karma.Server(localConfig, function(failCount) {
    done(failCount ? new Error(`Failed ${failCount} tests.`) : null);
  });
  server.start();
}

function nsp(cb) {
  gulpNSP({
    package: __dirname + '/package.json'
  }, cb);
}

gulp.task('nsp', nsp);

gulp.task('test', function(done) {
  runTests(true, done);
});

gulp.task('test:auto', function(done) {
  runTests(false, done);
});

gulp.task('build', build);
gulp.task('clean', clean);
gulp.task('default', ['nsp', 'clean', 'build']);

/**
 * section: Example build and run
 */

function buildExample() {
  buildCoffee(`./${paths.example}/lib/`);
}

function cleanExample() {
  return del([`./${paths.example}/lib`]);
}

gulp.task('connect', function() {
  connect.server({
    root: paths.example,
    livereload: true
  });
});

gulp.task('html', function() {
  gulp.src(`./${paths.example}/*.html`)
    .pipe(connect.reload());
});

gulp.task('watch', function() {
  gulp.watch([`./${paths.example}/*.html`], ['html']);
});

gulp.task('example:clean', cleanExample);
gulp.task('example:build', ['example:clean'], buildExample);
gulp.task('example', ['example:build', 'connect', 'watch']);

/**
 * section: Demo build
 */

function buildDemo() {
  buildCoffee(`./${paths.demo}/lib/`);
}

function cleanDemo() {
  return del([`./${paths.demo}/lib`]);
}

gulp.task('demo:clean', cleanDemo);
gulp.task('demo', ['demo:clean'], buildDemo);
