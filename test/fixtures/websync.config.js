module.exports = {
  source: './foo',
  target: 's3://nope',
  diffBy: 'modtime',
  invalidateDeletes: false,
}