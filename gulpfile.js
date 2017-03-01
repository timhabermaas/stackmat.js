const path = require('path');
const del = require('del');
const gulp = require('gulp');
const gutil = require('gulp-util');
const coffeelint = require('gulp-coffeelint');
const coffee = require('gulp-coffee');
const connect = require('gulp-connect');
const gulpNSP = require('gulp-nsp');
const karma = require('karma');

const paths = {
  src: 'src',
  dist: 'build',
  demo: 'example'
};

function clean() {
  return del([`./${paths.dist}`]);
}

function buildCoffee(dest) {
  gulp.src(`./${paths.src}/*.coffee`)
    .pipe(coffeelint())
    .pipe(coffeelint.reporter())
    .pipe(coffee({
      bare: false
    }).on('error', gutil.log))
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

function buildExample() {
  buildCoffee(`./${paths.demo}/lib/`);
}

gulp.task('nsp', function(cb) {
  gulpNSP({
    package: __dirname + '/package.json'
  }, cb);
});

gulp.task('test', function(done) {
  runTests(true, done);
});

gulp.task('test:auto', function(done) {
  runTests(false, done);
});

gulp.task('build', build);
gulp.task('clean', clean);
gulp.task('default', ['nsp', 'clean', 'build']);

gulp.task('connect', function() {
  connect.server({
    root: paths.demo,
    livereload: true
  });
});

gulp.task('html', function() {
  gulp.src(`./${paths.demo}/*.html`)
    .pipe(connect.reload());
});

gulp.task('watch', function() {
  gulp.watch([`./${paths.demo}/*.html`], ['html']);
});

gulp.task('example:build', buildExample);
gulp.task('example', ['example:build', 'connect', 'watch']);
