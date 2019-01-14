const aws = require('aws-sdk'),
documentClient = new aws.DynamoDB.DocumentClient();

const responseTemplate = (responseBody) => {
  return responseBody;
};
const successBodyTemplate = () => {
  return {'result': 'Success'};
};
const errorBodyTemplate = (message) => {
  return {'result': 'Fail', 'reason': message};
};

exports.handler = (event, context, callback) => {
  const tableName = 'Pokemons';
  const httpMethod = event.httpMethod;
  let number;
  let name;
  let type;
  let searchByNumberParam;

  // パラメータの取得
  switch (httpMethod) {
    case 'GET':
    case 'DELETE':
    case 'POST':
    case 'PUT':
      number = Number(event['number']);
      searchByNumberParam = {
        TableName: tableName,
        Key:{'number': number}
      };
      break;
  }
  switch (httpMethod) {
    case 'PUT':
      if (!number) {
        callback(null, responseTemplate(errorBodyTemplate('numberが指定されていません。')));
        return;
      }
    case 'POST':
      name = event['name'];
      type = event['type'];
      if (!name) {
        callback(null, responseTemplate(errorBodyTemplate('nameが指定されていません。')));
        return;
      }
      if (!type) {
        callback(null, responseTemplate(errorBodyTemplate('typeが指定されていません。')));
        return;
      }
      break;
  }

  // 処理実行
  switch (httpMethod) {
      case 'GET':
      if (number) {
          // 任意のポケモンの全属性値の取得
        documentClient.get(searchByNumberParam, (err, data) => {
            if (err || Object.keys(data).length === 0) {
                callback(null, errorBodyTemplate(`ポケモンナンバー「${number}」のポケモンは登録されていません。`));
            } else {
              let pokemon = data.Item;
              callback(null, {
                'number': pokemon.number,
                'name': pokemon.name,
                'type': pokemon.type
              });
            }
        });
      } else {
        // 全件取得
        documentClient.scan({TableName: tableName}, (err, data) => {
          let pokemons = data.Items;
          let resultPokemons = [];
          if (!err && pokemons) {
            // タイプを除外する
            for (let pokemon of pokemons) {
              resultPokemons.push({'number': pokemon.number, 'name': pokemon.name});
            }
          }
          callback(null, responseTemplate({'pokemons': resultPokemons}));
        });
      }
      return;
    case 'PUT':
      documentClient.get(searchByNumberParam, (err, data) => {
          if (err || Object.keys(data).length > 0) {
              callback(null, errorBodyTemplate(`ポケモンナンバー「${number}」のポケモンは既に登録されています。`));
          } else {
            let registData = {
              'number': number,
              'name': name,
              'type': type
            };
            // 保存
            documentClient.put({
                'TableName': tableName,
                'Item': registData
            }, function() {
                callback(null, successBodyTemplate());
            });
          }
      });
      return;
    case 'POST':
    case 'DELETE':
      documentClient.get(searchByNumberParam, (err, data) => {
        if (err || Object.keys(data).length === 0) {
          callback(null, errorBodyTemplate(`ポケモンナンバー「${number}」のポケモンは登録されていません。`));
          return;
        }
        if (httpMethod === 'POST') {
            // 任意のポケモンの全属性の上書き更新
            let updateParams = {
                TableName: tableName,
                Key:{'number': number},
                ExpressionAttributeNames: {'#name' : 'name', '#type' : 'type'},
                ExpressionAttributeValues: {':name' : name, ':type' : type},
                UpdateExpression: 'SET #name = :name, #type = :type'
            };
            documentClient.update(updateParams, (err, data) => {
              if (!err) {
                callback(null, responseTemplate(successBodyTemplate()));
              }
            });
        } else {
          // 任意のポケモンの削除
          documentClient.delete(searchByNumberParam, (err, data) => {
            if (!err) {
              callback(null, responseTemplate(successBodyTemplate()));
            }
          });
        }
      });
      return;
    }
};