/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                      ||
||                                                              ||
||  File Name: LMRY_libSendingEmailsLBRY_V2.0.js				        ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jun 20 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

define(['N/search', 'N/https', 'N/log', 'N/email', 'N/runtime', 'N/record', 'N/url', 'N/format', 'N/https'],

  function(search, https, log, email, runtime, record, url, format, https) {
    /* Formato de las columnas de la tabla */
    var colStyl = 'style=\"text-align: center; font-size: 9pt; font-weight:bold; color:white; background-color:#d50303; border: 1px solid #d50303; ';
    var rowStyl = 'style=\"text-align: Left;   font-size: 9pt; font-weight:bold; border: 1px solid #d50303; ';
    var errStyl = 'style=\"text-align: Left;   font-size: 9pt; font-weight:bold; color:red;border: 1px solid #d50303; ';

    var width_td1 = " width:50%;\">";
    var width_td2 = " width:50%;\">";
    var LMRY_script = 'LMRY_libSendingEmailsLBRY V2.0';
    var isURET = new Boolean();
    /// como prueba lenguaje portugues en el script.
    var MSG_TEXT = {
      'NETWORK_ERROR': {
        'es': 'NetworkError: Se ha produccido un error de conexion a internet o se a cumplido el tiempo de espera de actividad en NetSuite. Por favor vuelva ha iniciar sesion.',
        'en': 'NetworkError: An Internet Connection Error has occurred or the activity timeout has expired in NetSuite. Please, log in again.',
        'pt': 'NetworkError: ocorreu um erro de conexão com a Internet ou o tempo limite da atividade expirou no NetSuite. Por favor faça login novamente.'
      },
      'SESSION_TIMEOUT': {
        'es': 'Session Timed Out: Se ha cumplido el tiempo de espera de actividad en NetSuite. Por favor vuelva ha iniciar sesion.',
        'en': 'Session Timed Out: The activity timeout has expired in NetSuite. Please, log in again.',
        'pt': 'Session Timed Out: O tempo limite da atividade do NetSuite expirou. Por favor faça login novamente'
      },
      'DESCRIPTION': {
        'es': 'Descripcion',
        'en': 'Description',
        'pt': 'descrição'
      },
      'DETAILS': {
        'es': 'Detalle',
        'en': 'Detail',
        'pt': 'Detalhe'
      },
      'DATE': {
        'es': 'Fecha y Hora',
        'en': 'Date and hour',
        'pt': 'Data e hora'
      },
      'ENVIRONMENT': {
        'es': 'Ambiente',
        'en': 'Environment',
        'pt': 'Ambiente'
      },
      'CODE_CLIENT': {
        'es': 'Codigo Cliente (Company)',
        'en': 'Client Code (Company)',
        'pt': 'Código do Cliente (Empresa)'
      },
      'SUBSIDIARY': {
        'es': 'Subsidiaria del Usuario (ID)',
        'en': 'Client Subsidiary (ID)',
        'pt': 'Subsidiária do cliente (ID)'
      },
      'NAME_USER': {
        'es': 'Nombre de Usuario (User) ',
        'en': 'Client Name (User)',
        'pt': 'Nome do Cliente (Usuário)'
      },
      'TYPE_TRANSACTION': {
        'es': 'Tipo de Transaccion (Type) ',
        'en': 'Transaction Type',
        'pt': 'Tipo de transação'
      },
      'ID_TRANSACTION': {
        'es': 'Numero interno de la Transaccion (Internal ID) ',
        'en': 'Transaction Internal ID',
        'pt': 'ID interno da transação'
      },
      'ROL_USER': {
        'es': 'ID Rol del usuario (Role)',
        'en': 'Client Role ID(Role)',
        'pt': 'ID da função do cliente (função)'
      },
      'ROL': {
        'es': 'Centro de roles (Rol)',
        'en': 'Role Center (Role)',
        'pt': 'Centro de Funções (Função)'
      },
      'SALUTATION': {
        'es': 'Estimado(a) ',
        'en': 'Dear ',
        'pt': 'Querido(a) '
      },
      'EXECUTION': {
        'es': 'Contexto de ejecución',
        'en': 'Execution Context',
        'pt': 'Contexto de Execução'
      },
      'TRANID': {
        'es': 'Entidad<br>Identificador de la Transaccion ',
        'en': 'Entity<br>Transaction Identifier ',
        'pt': 'Entidade <br> identificador de transação'
      },
      'SUBJECT_ERROR': {
        'es': '<p>Este es un mensaje de error automático de LatamReady SuiteApp.</p><p>El detalle es el siguiente:</p>',
        'en': '<p>This is an automatic error message from LatamReady SuiteApp.</p><p>The details is as follows:</p>',
        'pt': '<p>Esta é uma mensagem de erro automática do LatamReady SuiteApp.</p><p>Os detalhes são os seguintes:</p>'
      },
      'BODY_ERROR': {
        'es': '<p>Por favor, comunícate con nuestro departamento de Servicio al Cliente a: customer.care@latamready.com</p><p>Nosotros nos encargamos.</p><p>Saludos,</p><p>El Equipo de LatamReady</p>',
        'en': '<p>Please contact our Customer Service department at: customer.care@latamready.com who will take care of the matter.</p><p>Regards,</p><p>The LatamReady Team</p>',
        'pt': '<p>Por favor entre em contato com o departamento de atendimento ao cliente em: customer.care@latamready.com, que cuidará do assunto.</p><p>Atenciosamente,</p><p>Equipe LatamReady</p>'
      },
      'END_ERROR': {
        'es': '<i>Este es un mensaje automático. Por favor, no responda este correo electrónico.</i>',
        'en': '<i>This is an automatic generated message. Please do not reply to this email.</i>',
        'pt': '<i>Esta é uma mensagem gerada automaticamente. Por favor, não responda a este e-mail.</i>'
      }
    }

    /* ------------------------------------------------------------------------------------------------------
     * Muestra los campos de columna filtrandos por el pais de la subsidiaria
     * custrecord_lmry_section = 3 va en el colummn transaction
     * --------------------------------------------------------------------------------------------------- */

    function onViewColumn(Country) {
      // Cancelar Funcion
      return true;

      Country = DeleteChar(Country);

      /* Se realiza una busqueda para ver que campos se ocultan */
      //var filters = new Array();
      var filters = new Array();

      filters[0] = search.createFilter({
        name: 'custrecord_lmry_section',
        operator: search.Operator.ANYOF,
        values: [3]
      });

      filters[1] = search.createFilter({
        name: 'custrecord_lmry_purchases',
        operator: search.Operator.IS,
        values: ['F']
      });

      // var columns = new Array();
      var columns = new Array();

      columns[0] = search.createColumn({
        name: 'name'
      });
      columns[1] = search.createColumn({
        name: 'custrecord_lmry_country'
      });

      var hidefields = search.create({
        type: 'customrecord_lmry_fields',
        columns: columns,
        filters: filters
      });

      hidefields = hidefields.run().getRange(0, 1000);

      if (hidefields != null && hidefields != '') {
        for (var i = 0; i < hidefields.length; i++) {
          var namefield = hidefields[i].getValue('name');
          var counfield = hidefields[i].getText('custrecord_lmry_country');
          counfield = DeleteChar(counfield);
          // Valida Paises
          if (counfield == Country) {
            onShowColumn(namefield);
          }
        }
      }
      return true;
    }

    /* ------------------------------------------------------------------------------------------------------
     * Oculta los campos que se encuentran en el registro personalizado customrecord_lmry_fields
     * custrecord_lmry_section = 1 va en el body Entity
     * custrecord_lmry_section = 2 va en el body transaction
     * --- 			Notas importantes 			---
     * La funcion onFieldsHide() se encarga de ocultar los campos
     * personalizados LATAM (Estos campos son instalados con el bundle LatamReady
     * 37714), estos campos se encuentran configurados en el registro personalizado:
     * Name: LatamReady - Fields Hide - ID: customrecord_lmry_hide_fields
     * --------------------------------------------------------------------------------------------------- */

    function onFieldsHide(paramsection, currentRCD, isURET) {

      var errp;
      //var currentRCD = currentRecord.get();
      /* Se realiza una busqueda para ver que campos se ocultan */
      var filters = new Array();

      filters[0] = search.createFilter({
        name: 'custrecord_lmry_hide_section',
        operator: search.Operator.ANYOF,
        values: paramsection
      });

      filters[1] = search.createFilter({
        name: 'isinactive',
        operator: search.Operator.IS,
        values: ['F']
      });

      var columns = new Array();

      columns[0] = search.createColumn({
        name: 'name'
      });

      columns[1] = search.createColumn({
        name: 'custrecord_lmry_hide_section'
      });

      var hidefields = search.create({
        type: 'customrecord_lmry_hide_fields',
        columns: columns,
        filters: filters
      });

      hidefields = hidefields.run().getRange(0, 1000);
      //log.error('hidefields', hidefields.length);
      if (hidefields != null && hidefields != '') {

        for (var i = 0; i < hidefields.length; i++) {
          var namefield = hidefields[i].getValue('name');
          var sectfield = hidefields[i].getValue('custrecord_lmry_hide_section');
          // Oculta el campo
          if (sectfield == 3) {


            var List_Expense = currentRCD.getLineCount({
              sublistId: 'expense'
            });

            for (var i = 0; i < List_Expense; i++) {
              var Field = null;
              Field = currentRCD.getSublistField({
                sublistId: 'expense',
                fieldId: namefield,
                line: i
              });
              if (Field != null && Field != '') {
                Field.isDisplay = false;
              }
            }

            var List_Item = currentRCD.getLineCount({
              sublistId: 'item'
            });

            for (var i = 0; i < List_Item; i++) {
              var Field = null;
              Field = currentRCD.getSublistField({
                sublistId: 'item',
                fieldId: namefield,
                line: i
              });
              if (Field != null && Field != '') {
                Field.isDisplay = false;
              }
            }


            // nlapiSetLineItemDisplay('expense', namefield, false);
            // nlapiSetLineItemDisplay('item', namefield, false);
            //falta codigo 1.0
            //1.0

            // currentRCD.getField({
            //   fieldId: namefield
            // }).isDisplay = false;
            //
            // currentRCD.getField({
            //   fieldId: namefield
            // }).isDisplay = false;
          } else {
            // log.error('ocultar',namefield);
            if (isURET) {

              var Field = null;
              try {

                Field = currentRCD.getField(namefield);

                if (Field != null && Field != '') {
                  Field.updateDisplayType({
                    displayType: 'hidden'
                  });
                }

              } catch (err) {
                //log.error('err', err);
              }
              // nlapiSetFieldDisplay(namefield, false);
              // 1.0

            } else {
              var Field = null;
              //log.error('ocultar',namefield);
              Field = currentRCD.getField({
                fieldId: namefield
              });
              if (Field != null && Field != '') {
                Field.isDisplay = false;
              }
            }
          }
        }
      }

      return true;
    }

    /* ------------------------------------------------------------------------------------------------------
     * Muestra los campos filtrandos por el pais de la subsidiaria
     * --- 			Notas importantes 			---
     * La funcion onFieldsDisplay() se encarga de mostrar los campos personalizados LATAM
     * (Estos campos son instalados con el bundle LatamReady 37714), estos campos se encuentran
     * configurados en el registro personalizado:
     * Name: LatamReady - Fields View - ID: customrecord_lmry_fields
     * en el segundo registro personalizado se configuran los campos a mostrar por
     * pais de subsidiaria.
     * --------------------------------------------------------------------------------------------------- */

    function onFieldsDisplay(currentRCD, Country, paramsection, isURET) {

      Country = DeleteChar(Country);

      /* Se realiza una busqueda para ver que campos se ocultan */
      var filters = new Array();

      filters[0] = search.createFilter({
        name: 'custrecord_lmry_section',
        operator: search.Operator.ANYOF,
        values: paramsection
      });


      var columns = new Array();

      columns[0] = search.createColumn({
        name: 'name'
      });

      columns[1] = search.createColumn({
        name: 'custrecord_lmry_country'
      });

      var hidefields = search.create({
        type: 'customrecord_lmry_fields',
        columns: columns,
        filters: filters
      });

      hidefields = hidefields.run().getRange(0, 1000);

      if (hidefields != null && hidefields != '') {
        for (var i = 0; i < hidefields.length; i++) {
          var namefield = hidefields[i].getValue('name');
          var counfield = hidefields[i].getText('custrecord_lmry_country');
          counfield = DeleteChar(counfield);
          //log.error('DeleteChar(counfield)',counfield);
          // Valida Paises
          if (counfield == Country) {

            // var Field = currentRCD.getField({
            //   fieldId: namefield
            // });
            // if (Field != null && Field != '') {
            //   Field.isDisplay = true;
            // }

            if (isURET) {
              var Field = null;
              Field = currentRCD.getField({
                id: namefield
              });

              if (Field != null && Field != '') {
                Field.updateDisplayType({
                  displayType: 'normal'
                });
              }
            } else {

              var Field = currentRCD.getField({
                fieldId: namefield
              });
              if (Field != null && Field != '') {
                Field.isDisplay = true;
              }
            }
          }
        }
      }
      return true;
    }

    /* ------------------------------------------------------------------------------------------------------
     * Muestra los campos filtrandos por el pais de la subsidiaria en la Entidad
     * --------------------------------------------------------------------------------------------------- */
    function onFieldsDisplayE(currentRCD, Country, isURET) {
      // var currentRCD = currentRecord.get();

      Country = DeleteChar(Country);

      /* Se realiza una busqueda para ver que campos se ocultan */
      var filters = new Array();

      filters[0] = search.createFilter({
        name: 'isinactive',
        operator: search.Operator.IS,
        values: ['F']
      });

      filters[1] = search.createFilter({
        name: 'custrecord_lmry_section',
        operator: search.Operator.ANYOF,
        values: [1]
      });


      var columns = new Array();

      columns[0] = search.createColumn({
        name: 'name'
      });

      columns[1] = search.createColumn({
        name: 'custrecord_lmry_country'
      });

      var hidefields = search.create({
        type: 'customrecord_lmry_fields',
        columns: columns,
        filters: filters
      });

      hidefields = hidefields.run().getRange(0, 1000);


      if (hidefields != null && hidefields != '') {
        for (var i = 0; i < hidefields.length; i++) {
          var namefield = hidefields[i].getValue('name');
          var counfield = hidefields[i].getText('custrecord_lmry_country');
          counfield = DeleteChar(counfield);
          // Valida Paises
          if (counfield == Country) {
            // var Field = currentRCD.getField(namefield);
            // if (Field != null && Field != '') {
            //   Field.isDisplay = true;
            // }

            if (isURET) {

              var Field = null;
              try {

                Field = currentRCD.getField({
                  id: namefield
                });

                if (Field != null && Field != '') {

                  Field.updateDisplayType({
                    displayType: 'normal'
                  });
                }

              } catch (err) {

              }
              // nlapiSetFieldDisplay(namefield, false);
              // 1.0

            } else {
              var Field = null;

              Field = currentRCD.getField({
                fieldId: namefield
              });
              if (Field != null && Field != '') {
                Field.isDisplay = true;
              }
            }
          }
        }
      }
      return true;
    }

    /* ------------------------------------------------------------------------------------------------------
     * Muestra los campos filtrandos por el pais de la subsidiaria en la transaccion Cheque
     * --------------------------------------------------------------------------------------------------- */

    function onFieldsDisplayBody(currentRCD, Country, custrecord, isURET) {
      //var currentRCD = currentRecord.get();
      try {

        Country = DeleteChar(Country);
        /* Se realiza una busqueda para ver que campos se ocultan */
        var filters = new Array();

        filters[0] = search.createFilter({
          name: custrecord,
          operator: search.Operator.IS,
          values: ['T']
        });

        filters[1] = search.createFilter({
          name: 'isinactive',
          operator: search.Operator.IS,
          values: ['F']
        });

        var columns = new Array();
        columns[0] = search.createColumn({
          name: 'name'
        });

        columns[1] = search.createColumn({
          name: 'custrecord_lmry_country'
        });


        var hidefields = search.create({
          type: 'customrecord_lmry_fields',
          columns: columns,
          filters: filters
        });

        hidefields = hidefields.run().getRange(0, 1000);


        if (hidefields != null && hidefields != '') {
          for (var i = 0; i < hidefields.length; i++) {
            var namefield = hidefields[i].getValue('name');
            var counfield = hidefields[i].getText('custrecord_lmry_country');
            counfield = DeleteChar(counfield);

            // Valida Paises
            if (counfield == Country) {
              if (isURET) {
                var Field = null;
                Field = currentRCD.getField({
                  id: namefield
                });

                if (Field != null && Field != '') {
                  Field.updateDisplayType({
                    displayType: 'normal'
                  });
                }
              } else {
                var Field = currentRCD.getField({
                  fieldId: namefield
                });
                if (Field != null && Field != '') {
                  Field.isDisplay = true;
                }
              }
            }
          }
        }
      } catch (err) {
        sendemail(' [ onFieldsDisplayBody ] ' + err, LMRY_script);
      }
    }

    /* ------------------------------------------------------------------------------------------------------
     * Transaction Sales Record
     * --------------------------------------------------------------------------------------------------- */
    function onFieldsDisplayParent(currentRCD, Country, parent, isURET) {
      //funcion descartada
      return true;

      // if (parent != '' && parent != null) {
      //   var arregloHide = new Array();
      //   Country = DeleteChar(Country);
      //   /* Se realiza una busqueda para ver que campos se ocultan */
      //   var filters = new Array();
      //   filters[0] = search.createFilter({
      //     name: 'custrecord_lmry_section',
      //     operator: search.Operator.ANYOF,
      //     values: [2]
      //   });
      //
      //   //if (parent == '' || parent == null) {
      //
      //   filters[1] = search.createFilter({
      //     name: 'custrecord_lmry_parent',
      //     operator: search.Operator.NONEOF,
      //     values: ['@NONE@']
      //   });
      //   //
      //   // } else {
      //   //   filters[1] = search.createFilter({
      //   //     name: 'custrecord_lmry_parent',
      //   //     operator: search.Operator.ANYOF,
      //   //     values: [parent]
      //   //   });
      //   // }
      //
      //   filters[2] = search.createFilter({
      //     name: 'custrecord_lmry_country',
      //     operator: search.Operator.IS,
      //     values: [Country]
      //   });
      //
      //   var columns = new Array();
      //   columns[0] = search.createColumn({
      //     name: 'name'
      //   });
      //
      //   columns[1] = search.createColumn({
      //     name: 'custrecord_lmry_country'
      //   });
      //
      //   columns[2] = search.createColumn({
      //     name: 'custrecord_lmry_section'
      //   });
      //
      //   columns[3] = search.createColumn({
      //     name: 'custrecord_lmry_parent'
      //   });
      //
      //   var hidefields = search.create({
      //     type: 'customrecord_lmry_fields',
      //     columns: columns,
      //     filters: filters
      //   });
      //
      //   hidefields = hidefields.run().getRange(0, 1000);
      //
      //   if (hidefields != null && hidefields != '') {
      //     for (var i = 0; i < hidefields.length; i++) {
      //       var namefield = hidefields[i].getValue('name');
      //       var sectfield = hidefields[i].getValue('custrecord_lmry_section');
      //       var counfield = hidefields[i].getText('custrecord_lmry_country');
      //       var parentfield = hidefields[i].getValue('custrecord_lmry_parent');
      //       counfield = DeleteChar(counfield);
      //       // Valida Paises
      //       if (counfield == Country) {
      //
      //         if (isURET == false) {
      //           if (parentfield != parent) {
      //
      //             var Field = currentRCD.getField({
      //               fieldId: namefield
      //             });
      //             if (Field != null && Field != '') {
      //               Field.isDisplay = false;
      //             }
      //
      //           } else {
      //             arregloHide.push(namefield);
      //           }
      //         } else {
      //
      //           if (parentfield == parent) {
      //             var Field = null;
      //             Field = currentRCD.getField({
      //               id: namefield
      //             });
      //             if (Field != null && Field != '') {
      //               Field.updateDisplayType({
      //                 displayType: 'normal'
      //               });
      //             }
      //
      //           }
      //         }
      //
      //       }
      //     }
      //   }
      //
      //   for (var i = 0; i < arregloHide.length; i++) {
      //     var Field = currentRCD.getField({
      //       fieldId: arregloHide[i]
      //     });
      //     if (Field != null && Field != '') {
      //       Field.isDisplay = true;
      //     }
      //   }
      //   return true;
      // }
      // return true;
    }


    function ParentNuevo(currentRCD, Country, parent, isURET) {

      //log.error('currentRCD, Country, parent, isURET', currentRCD + ',' + Country + ',' + parent + ',' + isURET);
      //var error;
      try {


        Country = DeleteChar(Country);
        /* Se realiza una busqueda para ver que campos se ocultan */
        // var filters = new Array();
        // filters[0] = search.createFilter({
        //   name: 'custrecord_lmry_country',
        //   operator: search.Operator.ANYOF,
        //   values: [Country]
        // });
        var filters = new Array();
        // filters[0] = search.createFilter({
        //   name: 'custrecord_lmry_parent',
        //   operator: search.Operator.ANYOF,
        //   values: [parent]
        // });

        filters[0] = search.createFilter({
          name: 'custrecord_lmry_country',
          operator: search.Operator.ANYOF,
          values: [Country]
        });



        var columns = new Array();
        columns[0] = search.createColumn({
          name: 'name'
        });

        columns[1] = search.createColumn({
          name: 'custrecord_lmry_country'
        });

        columns[2] = search.createColumn({
          name: 'custrecord_lmry_parent'
        });

        // var columns = new Array();
        // columns[2] = search.createColumn({
        //   name: 'custrecord_lmry_country'
        // });

        var hidefields = search.create({
          type: 'customrecord_lmry_fields',
          columns: columns,
          filters: filters
        });


        hidefields = hidefields.run().getRange(0, 1000);


        var list = new Array();
        //var list2 = new Array();
        if (hidefields != null && hidefields != '') {
          for (var i = 0; i < hidefields.length; i++) {
            var namefield = hidefields[i].getValue('name');
            var counfield = hidefields[i].getText('custrecord_lmry_country');
            var typeparent = hidefields[i].getText('custrecord_lmry_parent');
            list.push(namefield);
            //list.push(typeparent);
            // var sectfield = hidefields[i].getValue('custrecord_lmry_section');
            counfield = DeleteChar(counfield);
            // Valida Paises
            if (counfield == Country) {

              //   var Field = currentRCD.getField({
              //     fieldId: namefield
              //   });
              //   if (Field != null && Field != '') {
              //     currentRCD.getField({
              //       fieldId: namefield
              //     }).isDisplay = true;
              //     //Field.isDisplay = true;
              //   }
              //   //log.error('error', Field);
              // }
              // Cliente: isUret = false

              if (isURET) {

                var Field = null;
                try {

                  Field = currentRCD.getField({
                    id: namefield
                  });

                  if (Field != null && Field != '') {

                    Field.updateDisplayType({
                      displayType: 'normal'
                    });
                  }
                } catch (err) {}
              } else {

                var Field = currentRCD.getField({
                  fieldId: namefield
                });
                if (typeparent != null && typeparent != '') {
                  if (Field != null && Field != '') {
                    Field.isDisplay = false;
                  }
                }
              }
            }
          }
        }

        return true;
      } catch (err) {}
    }

    /* ------------------------------------------------------------------------------------------------------
     * Transaction Sales Record
     * --------------------------------------------------------------------------------------------------- */
    function onFieldsDisplayParent2(currentRCD, Country, parent, isURET) {
      try{
        // var currentRCD = currentRecord.get();

        if (!parent) {
          return false;
        }

        Country = DeleteChar(Country);

        /* Se realiza una busqueda para ver que campos se ocultan */
        var filters = new Array();

        filters[0] = search.createFilter({
          name: 'custrecord_lmry_section',
          operator: search.Operator.ANYOF,
          values: [2]
        });
        filters[1] = search.createFilter({
          name: 'custrecord_lmry_parent_er',
          operator: search.Operator.ANYOF,
          values: [parent]
        });

        var columns = new Array();
        columns[0] = search.createColumn({
          name: 'name'
        });

        columns[1] = search.createColumn({
          name: 'custrecord_lmry_country'
        });



        var hidefields = search.create({
          type: 'customrecord_lmry_fields',
          columns: columns,
          filters: filters
        });

        hidefields = hidefields.run().getRange(0, 1000);

        if (hidefields != null && hidefields != '') {
          for (var i = 0; i < hidefields.length; i++) {
            var namefield = hidefields[i].getValue('name');
            var counfield = hidefields[i].getText('custrecord_lmry_country');
            counfield = DeleteChar(counfield);
            // Valida Paises
            if (counfield == Country) {

              if (isURET) {
                var Field = currentRCD.getField({
                  id: namefield
                });

                if (Field) {
                  Field.updateDisplayType({
                    displayType: 'normal'
                  });
                }
              } else {
                var Field = currentRCD.getField({
                  fieldId: namefield
                });
                if (Field) {
                  Field.isDisplay = true;
                }
              }
            }
          }
        }
      } catch (err) {
        sendemail(' [ onFieldsDisplayParent2 ] ' + err, LMRY_script);
      }
      return true;
    }

    /* ------------------------------------------------------------------------------------------------------
     * Transaction Sales Record
     * --------------------------------------------------------------------------------------------------- */
    function onFieldsDisplayS(currentRCD, Country, parent) {
      // var currentRCD = currentRecord.get();

      Country = DeleteChar(Country);

      /* Se realiza una busqueda para ver que campos se ocultan */
      var filters = new Array();
      filters[0] = search.createFilter({
        name: 'custrecord_lmry_section',
        operator: search.Operator.ANYOF,
        values: [2, 3]
      });

      filters[1] = search.createFilter({
        name: 'custrecord_lmry_parent',
        operator: search.Operator.ANYOF,
        values: [parent]
      });

      var columns = new Array();

      columns[0] = search.createColumn({
        name: 'name'
      });

      columns[1] = search.createColumn({
        name: 'custrecord_lmry_country'
      });

      columns[2] = search.createColumn({
        name: 'custrecord_lmry_section'
      });

      var hidefields = search.create({
        type: 'customrecord_lmry_fields',
        columns: columns,
        filters: filters
      });

      hidefields = hidefields.run().getRange(0, 1000);

      if (hidefields != null && hidefields != '') {
        for (var i = 0; i < hidefields.length; i++) {
          var namefield = hidefields[i].getValue('name');
          var sectfield = hidefields[i].getValue('custrecord_lmry_section');
          var counfield = hidefields[i].getText('custrecord_lmry_country');
          counfield = DeleteChar(counfield);
          // Valida Paises
          if (counfield == Country) {
            var Field = currentRCD.getField({
              fieldId: namefield
            });
            if (Field != null && Field != '') {
              Field.isDisplay = true;
            }
          }
        }
      }
      return true;
    }

    /* ------------------------------------------------------------------------------------------------------
     * Valida que la sub subsidiaria se Peru
     * --------------------------------------------------------------------------------------------------- */
    function Get_Country_STLT2(subsidiari) {
      var runtimeRT = runtime.getCurrentScript();
      var country = new Array();
      country[0] = '';
      country[1] = '-None-';

      try {
        // Valida la subsidiaira
        if (subsidiari == '' || subsidiari == null) {
          subsidiari = 0;
          return country;
        }

        var urlpais = runtime.getCurrentScript().getParameter('custscript_lmry_netsuite_location');

        var url_2 = url.resolveScript({
          // scriptId: 'customscriptlmry_getcountrystlt_2',
          // deploymentId: 'customdeploylmry_getcountrystlt_2',
          scriptId: 'customscript_lmry_get_country_stlt',
          deploymentId: 'customdeploy_lmry_get_country_stlt',

          returnExternalUrl: false
        }) + '&sub=' + subsidiari;




        // var urlbase = runtime.getCurrentScript().getParameter('custscript_lmry_country_code_stlt');
        // log.error('urlbase',urlbase);

        // var urlnat = runtimeRT.getValue('custscript_lmry_netsuite_location');
        // log.error('url netsuite', urlnat);

        var get = https.get({
          url: 'https://' + urlpais + url_2
        });

        var bod = get.body;
        bod = bod.split(',');


        // var strdata2 = suitelet_get_country(subsidiari);
        // var bod = strdata2.split(',');

        country[0] = _GetResult('Country Cod', bod[0]);
        country[1] = _GetResult('Country Des', bod[1]);
        country[1] = DeleteChar(country[1]);

      } catch (err) {}
      return country;
    }

    function Get_Country_STLT(subsidiari) {

      var LMRY_access = false;
      var LMRY_countr = new Array();
      var par_subsidiari = subsidiari;
      var country = new Array();
      country[0] = '';
      country[1] = '';

      try {
        if (subsidiari != '' && subsidiari != null) {
          var filters = new Array();
          filters[0] = search.createFilter({
            name: 'internalid',
            operator: search.Operator.ANYOF,
            values: [subsidiari]
          });
          var columns = new Array();
          columns[0] = search.createColumn({
            name: 'country'
          });

          var getfields = search.create({
            type: 'subsidiary',
            columns: columns,
            filters: filters
          });

          getfields = getfields.run().getRange(0, 1000);

          if (getfields != '' && getfields != null) {
            country[0] = getfields[0].getValue('country');
            country[1] = getfields[0].getText('country');
          }
        }
      } catch (err) {

        try {

          var featuresubs = runtime.isFeatureInEffect({
            feature: 'SUBSIDIARIES'
          });

          if (featuresubs == true || featuresubs == 'T') {

            var par_country = Get_Country_STLT2(par_subsidiari);

            return par_country;

          } else {
            country[0] = runtime.getCurrentScript().getParameter({
              name: 'custscript_lmry_country_code_stlt'
            });
            country[1] = runtime.getCurrentScript().getParameter({
              name: 'custscript_lmry_country_desc_stlt'
            });
            return country;
          }

        } catch (err) {
          sendemail(' [ Get_Country_STLT ] ' + err, LMRY_script);
        }

      }

      return country;
    }

    function Validate_Permission(per_par) {
      try {

        var urlpais = runtime.getCurrentScript().getParameter('custscript_lmry_netsuite_location');

        var url_4 = url.resolveScript({
          scriptId: 'customscript_lmry_get_country_stlt',
          deploymentId: 'customdeploy_lmry_get_country_stlt',
          returnExternalUrl: false
        }) + '&ent=' + per_par;


        //corregir hard code falta url
        var url_rest = https.get({
          url: 'https://' + urlpais + url_4
        });

        var url_rest = url_rest.body;

      } catch (err) {
        sendemail(' [ Validate_Permission ] ' + err, LMRY_script);
      }


    }


    /* ------------------------------------------------------------------------------------------------------
     * Valida que la sub subsidiaria se Peru
     * --------------------------------------------------------------------------------------------------- */

    function Validate_Country(subsi) {
      var subsidiari = subsi;
      var country = new Array();
      country[0] = '';
      country[1] = '-None-';

      try {
        // Valida la subsidiaria
        if (subsidiari == '' || subsidiari == null) {
          subsidiari = 0;
        }

        // Verifica si es One World
        var featuresubs = runtime.isFeatureInEffect({
          feature: 'SUBSIDIARIES'
        });
        if (featuresubs == true || featuresubs == 'T') {
          if (subsidiari != 0) {
            /*var filters = new Array();
            filters[0] = search.createFilter({
              name: 'internalid',
              operator: search.Operator.ANYOF,
              values: [subsidiari]
            });

            var columns = new Array();
            columns[0] = search.createColumn({
              name: 'country'
            });

            var getfields = search.create({
              type: 'subsidiary',
              columns: columns,
              filters: filters
            });

            getfields = getfields.run().getRange(0, 1000);
            if (getfields != '' && getfields != null) {
              country[0] = getfields[0].getValue('country');
              country[1] = getfields[0].getText('country');
            }*/

            var getfields = search.lookupFields({
              type: 'subsidiary',
              id: subsidiari,
              columns: ['country']
            });
            country[0] = getfields.country[0].value;
            country[1] = getfields.country[0].text;
          }
        } else {
          country[0] = runtime.getCurrentScript().getParameter({
            name: 'custscript_lmry_country_code_stlt'
          });
          country[1] = runtime.getCurrentScript().getParameter({
            name: 'custscript_lmry_country_desc_stlt'
          });

        }
        country[1] = DeleteChar(country[1]);
      } catch (err) {
        sendemail(' [ Validate_Country ] ' + err, LMRY_script);
      }
      return country;
    }


    /************************************* MODIFICACIÓN ***********************************************************
       - Fecha: 07/05/2020
       - Descripción: Devolver valor del feature para ocultar campos Customer y Entity, en las TRANSACCIONES
       Customer Payment y Bill Payment, respectivamente.
    **************************************************************************************************************/

    function disableField(typeDoc, country, licenses) {
      try {

        var featureAc = false;
        var type = '';
        var val_feature = '';

        /*typeDoc
        - 1: Customer Payment
        - 2: Vendor Payment
        */

        switch (typeDoc) {
          case 'customerpayment':
            type = 1;
            break;

          case 'vendorpayment':
            type = 2;
            break;
        }

        var features_disable = {
          'AR': {
            1: 468,
            2: 469
          },
          'BO': {
            1: 470,
            2: 471
          },
          'BR': {
            1: 472,
            2: 473
          },
          'CL': {
            1: 474,
            2: 475
          },
          'CO': {
            1: 476,
            2: 477
          },
          'CR': {
            1: 478,
            2: 479
          },
          'EC': {
            1: 480,
            2: 481
          },
          'SV': {
            1: 482,
            2: 483
          },
          'GT': {
            1: 484,
            2: 485
          },
          'MX': {
            1: 486,
            2: 487
          },
          'NI': {
            1: 488,
            2: 489
          },
          'PA': {
            1: 490,
            2: 491
          },
          'PY': {
            1: 492,
            2: 493
          },
          'PE': {
            1: 494,
            2: 495
          },
          'DO': {
            1: 496,
            2: 497
          },
          'UY': {
            1: 498,
            2: 499
          }
        };

        if (features_disable[country]) {
          val_feature = features_disable[country][type];
        }

        if (val_feature != '' && val_feature != null) {
          featureAc = getAuthorization(val_feature, licenses);
        }

        return featureAc;

      } catch (err) {
        sendemail(' [ disableField ] ' + err, LMRY_script);
      }
    }

    // ********************************************FIN MODIFICACIÓN ***********************************************


    /* ------------------------------------------------------------------------------------------------------
     * Obtiene la lista de Features actuvo para la subsidiaria
     * @param subsidiary
     * --------------------------------------------------------------------------------------------------- */

    function getLicenses(subsidiary) {
      //  var arraysalida = [];
      var arrayLicenses = [];
      var urlText = url.resolveScript({
        scriptId: 'customscript_lmry_get_enable_feat_stlt',
        deploymentId: 'customdeploy_lmry_get_enable_feat_stlt',
        returnExternalUrl: true
      });

      urlText += '&subsi=' + subsidiary;
      var request = https.get({
        url: urlText
      });
      var featuresEnabled = request.body;
      var licensesFeatures;
      if (featuresEnabled != null && featuresEnabled != '') {
        licensesFeatures = JSON.parse(featuresEnabled);
        licensesFeatures.map(function(x) {
          arrayLicenses.push(parseInt(x));
          return true;
        });
      }

      return arrayLicenses;

    }

    /* ------------------------------------------------------------------------------------------------------
     * Obtiene la lista de Features actuvos para las subsidiarias
     * @param subsidiaries
     * --------------------------------------------------------------------------------------------------- */

    function getLicensesMultiSubsi(subsidiaries) {
      if (subsidiaries.length < 1) {
        return [];
      }
      //  var arraysalida = [];
      var arrayLicenses = [];
      var urlText = url.resolveScript({
        scriptId: 'customscript_lmry_get_enable_feat_stlt',
        deploymentId: 'customdeploy_lmry_get_enable_feat_stlt',
        returnExternalUrl: true
      });

      urlText += '&subsi=' + subsidiaries.join('|');
      var request = https.get({
        url: urlText
      });
    //  log.error('getLicensesMultiSubsi', request.body);
      var featuresEnabled = request.body;
      var licensesFeatures;
      if (featuresEnabled != null && featuresEnabled != '') {
        licensesFeatures = JSON.parse(featuresEnabled);
        licensesFeatures.map(function(x) {
          arrayLicenses.push(parseInt(x));
          return true;
        });
      }

      return arrayLicenses;

    }

    function getAllLicenses() {
      var allLicenses = {};
      var search_features = search.create({
        type: 'customrecord_lmry_features_by_subsi',
        filters: [
          ['custrecord_lmry_features_subsidiary.isinactive', 'is', 'F'],
          'AND',
          ['isinactive', 'is', 'F']
        ],
        columns: ['custrecord_lmry_features_subsidiary']
      });

      var aux_feature = [];
      var features_active = search_features.run().getRange(0, 100);
      if (features_active && features_active.length) {
        for (var i = 0; i < features_active.length; i++) {
          var subsidiary = features_active[i].getValue('custrecord_lmry_features_subsidiary');
          aux_feature.push(subsidiary);
        }
      }

      if (aux_feature.length < 1) {
        return {};
      }
      //  var arraysalida = [];

      var urlText = url.resolveScript({
        scriptId: 'customscript_lmry_get_enable_feat_stlt',
        deploymentId: 'customdeploy_lmry_get_enable_feat_stlt',
        returnExternalUrl: true
      });

      urlText += '&subsi=' + aux_feature.join('|') + '&json=T';
      var request = https.get({
        url: urlText
      });
      //log.error('getAllLicenses', request.body);
      var featuresEnabled = request.body;
      var licensesFeatures;
      if (featuresEnabled != null && featuresEnabled != '' && featuresEnabled != undefined) {
        licensesFeatures = JSON.parse(featuresEnabled);
        var arrayLicenses;
        for (var aux in licensesFeatures) {
          arrayLicenses = [];
          licensesFeatures[aux].map(function(x) {
            arrayLicenses.push(parseInt(x));
            return true;
          });
          allLicenses[aux] = arrayLicenses;
        }

      } else {
        allLicenses = {};
      }
      return allLicenses;
    }

    function getAuthorization(featureId, licenses) {
      try {
        //log.error('Libreria', 'getAuthorization ' + featureId);
        if (licenses && licenses.length) {
          var type_obj = typeof licenses;

          if (type_obj != 'object') {
            var new_licenses = JSON.parse(licenses);
            return new_licenses && new_licenses.indexOf(Number(featureId)) > -1;
          } else {
            //log.error('entra object');
            return licenses && licenses.indexOf(Number(featureId)) > -1;
          }

        } else {
          return false;
        }
      } catch (err) {
        sendemail(' [ getAuthorization ] ' + err, LMRY_script);
      }
    }


    function getHideView(arrCountry, section, licenses) {
      try {
        /*
        Section
        Entity: 1
        Transaction: 2
        Column: 3
        Record (Sublist): 5
        */
        var featureAc = false;
        var val_feature = '';
        //log.error('arrCountry-getHide', arrCountry);
        //log.error('licenses-getHide', licenses);

        //Features para h&v de acuerdo a sección
        var features_hide = {
          'AR': {
            1: -11,
            2: -12,
            3: -13,
            5: -14
          },
          'BO': {
            1: -51,
            2: -52,
            3: -53,
            5: -54
          },
          'BR': {
            1: -41,
            2: -42,
            3: -43,
            5: -44
          },
          'CL': {
            1: -31,
            2: -32,
            3: -33,
            5: -34
          },
          'CO': {
            1: -21,
            2: -23,
            3: -24,
            5: -22
          },
          'CR': {
            1: -71,
            2: -72,
            3: -73,
            5: -74
          },
          'EC': {
            1: -81,
            2: -82,
            3: -83,
            5: -84
          },
          'SV': {
            1: -91,
            2: -92,
            3: -93,
            5: -94
          },
          'GT': {
            1: -101,
            2: -102,
            3: -103,
            5: -104
          },
          'MX': {
            1: -111,
            2: -112,
            3: -113,
            5: -114
          },
          'NI': {
            1: -121,
            2: -122,
            3: -123,
            5: -124
          },
          'PA': {
            1: -131,
            2: -132,
            3: -133,
            5: -134
          },
          'PY': {
            1: -141,
            2: -142,
            3: -143,
            5: -144
          },
          'PE': {
            1: -61,
            2: -62,
            3: -63,
            5: -64
          },
          'DO': {
            1: -151,
            2: -152,
            3: -153,
            5: -154
          },
          'UY': {
            1: -161,
            2: -162,
            3: -163,
            5: -164
          }


        };

        if (features_hide[arrCountry[0]]) {
          val_feature = features_hide[arrCountry[0]][section];
        }

        if (val_feature != '' && val_feature != null) {
          featureAc = getAuthorization(val_feature, licenses);
        }

        return featureAc;

      } catch (err) {
        sendemail(' [ getHideView ] ' + err, LMRY_script);
      }

    }

    function getCountryOfAccess(arrCountry, licenses) {
      try {

        var val_feature = '';

        // Verifica que el arreglo este lleno
        if (arrCountry.length < 1) {
          return false;
        }

        var featureAc = false;

        //Localizacion
        var features_hide = {
          'AR': 100,
          'BO': 37,
          'BR': 140,
          'CL': 98,
          'CO': 26,
          'CR': 24,
          'EC': 42,
          'SV': 6,
          'GT': 133,
          'MX': 20,
          'PA': 137,
          'PY': 38,
          'PE': 136,
          'UY': 39,
          'DO': 399,
          'NI': 406
        };

        if (features_hide[arrCountry[0]]) {
          val_feature = features_hide[arrCountry[0]];
          //log.error('val_feature', val_feature);
        }

        if (val_feature != '' && val_feature != null) {
          featureAc = getAuthorization(val_feature, licenses);
          //log.error('featureAc', featureAc);
        }
        return featureAc;

      } catch (err) {
        sendemail(' [ getCountryOfAccess ] ' + err, LMRY_script);
      }

    }

    /* ------------------------------------------------------------------------------------------------------
     * Extrae los valores obtenidos del arreglo
     * como se muestra a continuacion.
     * Ejemplo:
     * 			array[0]="Nombre Campo":"Valor"
     *  		field = "Nombre Campo"
     *  		strdata = array[0]
     * --------------------------------------------------------------------------------------------------- */
    function _GetResult(field, strdata) {
      try {
        var intpos = strdata.indexOf('=');
        var straux = strdata.substr(0, parseInt(intpos));
        var strcad = '';
        if (field == straux) {
          // Extrae la cadena desde (:) para adelante
          straux = strdata.substr(parseInt(intpos) + 1);
          // Valida que el campo no de null
          if (straux == 'null') {
            return '';
          }
          // Barre el resto de la cadena
          for (var pos = 0; pos < straux.length; pos++) {
            if (straux[pos] != '"') {
              strcad += straux[pos];
            }
          }
          return strcad;
        }
      } catch (err) {
        sendemail(' [ _GetResult ] ' + err, LMRY_script);
      }
      return '';
    }

    /* ------------------------------------------------------------------------------------------------------
     * Borra las tildes
     * --------------------------------------------------------------------------------------------------- */
    function DeleteChar(cad) {
      // Valida que el campo no este vacio
      if (cad == '' || cad == null || cad == 'undefined') {
        return '';
      }
      // Realiza un barrido de la cadena
      var str = cad.split('');
      var aux = '';
      for (var pos = 0; pos < str.length; pos++) {
        var caden = str[pos];
        var ascii = caden.charCodeAt(0);
        switch (ascii) {
          case 97:
            aux += 'a';
            break;
          case 225:
            aux += 'a';
            break;
          case 101:
            aux += 'e';
            break;
          case 233:
            aux += 'e';
            break;
          case 105:
            aux += 'i';
            break;
          case 237:
            aux += 'i';
            break;
          case 111:
            aux += 'o';
            break;
          case 243:
            aux += 'o';
            break;
          case 117:
            aux += 'u';
            break;
          case 250:
            aux += 'u';
            break;
          default:
            aux += str[pos];
        }
      }

      // Devuelve la cadena
      return aux;
    }

    /* ------------------------------------------------------------------------------------------------------
     * Oculta los campos de columna de las transacciones
     * --------------------------------------------------------------------------------------------------- */
    function onHiddenColumn() {
      // Cancelar Funcion
      return true;

      try {
        if (runtime.executionContext === runtime.ContextType.USER_INTERFACE) {
          // Oculta el detalle de la transaccion
          jQuery('.listtable')
            .each(function(tblIdx, table) {

              jQuery('.listheadertd', table)
                .each(function(thIdx, th) {
                  var label = jQuery(th).attr('data-label') || '',
                    keyword = 'LATAM - COL ',
                    regex = new RegExp(keyword, 'i');

                  if (label.match(regex)) {
                    jQuery(th).hide();

                    jQuery('.uir-machine-row', table).each(function(trIdx, tr) {
                      jQuery(jQuery('td', tr)[thIdx]).hide();
                    });
                  }
                });
            });
          // Ingreso al procedimiento

        }
      } catch (err) {
        sendemail(' [ onHiddenColumn ] ' + err, "Client Script");
      }
      return true;
    }

    /* ------------------------------------------------------------------------------------------------------
     * Oculta los campos de columna de las transacciones
     * --------------------------------------------------------------------------------------------------- */

    function onShowColumn(keyword) {
      // Cancelar Funcion
      return true;

      try {

        if (runtime.executionContext === runtime.ContextType.USER_INTERFACE) {
          // Oculta el detalle de la transaccion
          jQuery('.listtable')
            .each(function(tblIdx, table) {

              jQuery('.listheadertd', table)
                .each(function(thIdx, th) {
                  var label = jQuery(th).attr('data-label') || '',
                    regex = new RegExp(keyword, 'i');


                  if (label.match(regex)) {
                    jQuery(th).show();

                    jQuery('.uir-machine-row', table).each(function(trIdx, tr) {
                      jQuery(jQuery('td', tr)[thIdx]).show();
                    });
                  }
                });
            });
        }
      } catch (err) {
        sendemail(' [ onShowColumn ] ' + err, "Client Script");
      }
      return true;
    }

    function getmatchfe(fecount, licenses) {

      var fe_getMatch = false;

      var authorization_match = {
        'AR': 274,
        'BO': 275,
        'BR': 276,
        'CL': 277,
        'CO': 278,
        'CR': 279,
        'EC': 280,
        'SV': 281,
        'GT': 282,
        'MX': 283,
        'PA': 284,
        'PY': 285,
        'PE': 286,
        'UY': 287
      };

      if (authorization_match[fecount]) {
        fe_getMatch = getAuthorization(authorization_match[fecount], licenses);
      }
      return fe_getMatch;

    }

    function autoline(currentRCD) {

      try {

        var country_m = currentRCD.getValue('custbody_lmry_subsidiary_country');

        if (country_m != '' && country_m != null) {

          var filters = new Array();
          filters[0] = search.createFilter({
            name: 'isinactive',
            operator: search.Operator.IS,
            values: [country_m]
          });
          filters[0] = search.createFilter({
            name: 'custrecord_lmry_taxtype_country',
            operator: search.Operator.ANYOF,
            values: ['F']
          });
          filters[0] = search.createFilter({
            name: 'custrecord_lmry_default',
            operator: search.Operator.IS,
            values: ['T']
          });


          var columns = new Array();
          columns[0] = search.createColumn({
            name: "custrecord_lmry_inv_id",
            label: "Latam - Invoicing ID"
          });
          columns[1] = search.createColumn({
            name: "custrecord_lmry_inv_id_code",
            label: "Latam - Invoicing ID Code"
          });
          columns[2] = search.createColumn({
            name: "formulatext",
            formula: "{custrecord_lmry_taxtype_code_invid} || ':' || {custrecord_lmry_tax_code_invid}",
            label: "Tax"
          });
          columns[3] = search.createColumn({
            name: "custrecord_lmry_default",
            label: "Latam - Tax Type Default"
          });

          var getmatchline = search.create({
            type: 'customrecord_lmry_taxtype_by_invoicingid',
            columns: columns,
            filters: filters
          });

          var resgetmatchline = getmatchline.run().getRange(0, 100);
          return resgetmatchline;
        }

      } catch (err) {
        sendemail(' [ autoline ] ' + err, LMRY_script);
      }
    }

    function setline(currentRCD, objsetline, settaxcode) {

      settaxcode = settaxcode + '';
      var invo_id = objsetline[0].getValue('formulatext') + '';

      if (settaxcode == invo_id) {
        currentRCD.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_lmry_invoicing_id',
          value: objsetline[0].getValue('custrecord_lmry_inv_id')
        });
      }
    }

    /* ------------------------------------------------------------------------------------------------------
     * Nota: Envio de mail al usuario.
     * 		 namereport = Nombre del reporte
     * 		 opc		= Opcion del mensaje
     * 		 msgreport  = Mensaje personalizado
     * --------------------------------------------------------------------------------------------------- */
    function sendrptuser(namereport, opc, msgreport) {

      // Dados del nlapiGetContext
      var namevers = runtime.version;
      var namecomp = runtime.accountId;
      var nameuser = runtime.getCurrentUser().name;

      // Apis de Netsuite

      // var namesubs = runtime.getCurrentUser().subsidiary;
      // // Verifica si es One World
      // var featuresubs = runtime.isFeatureInEffect({
      //   feature: 'SUBSIDIARIES'
      // });
      // if (featuresubs == true || featuresubs == 'T') {
      //   try {
      //     namesubs = search.lookupFields({
      //       type: 'subsidiary',
      //       id: namesubs,
      //       columns: ['name']
      //     });
      //     namesubs = namesubs.name;
      //
      //   } catch (err) {
      //     namesubs = runtime.getCurrentUser().subsidiary;
      //
      //   }
      // }

      try {

        var featuresubs = runtime.getCurrentUser();


        // var featuresubs = runtime.isFeatureInEffect({
        //   feature: 'SUBSIDIARIES'
        // });

        if (featuresubs != '' && featuresubs != null) {
          namesubs = featuresubs.subsidiary;
        }

      } catch (err) {
        log.error(LMRY_script, 'runtime.getCurrentUser() : ' + err);
      }

      // Datos del Usuario
      var userid = runtime.getCurrentUser();
      log.error('sendrptuser - userid', userid);
      var userfn = ['email', 'firstname'];
      // employ = search.lookupFields({
      //   type: 'employee',
      //   id: userid.id,
      //   columns: userfn
      // });

      employ = runtime.getCurrentUser();

      log.error('sendrptuser - email', employ.email);
      if (employ.email != '' && employ.email != null) {
        var empema = employ.email;
      } else {
        log.error('sendrptuser - userid', 'Usuario no tiene correo');

        return true;
      }
      //var empfir = employ.firstname;
      var empfir = employ.name;

      // Nombre Usuario y Correos
      log.error('Param: userid, empfir, empema', userid + ',' + empfir + ',' + empema);

      var datetime = new Date();


      var bmsg = '';
      bmsg += "<table style=\"font-family: Courier New, Courier, monospace; width:95%; border: 1px solid #d50303;\">";
      bmsg += "<tr>";
      bmsg += "<td " + colStyl + width_td1;
      bmsg += "Descripcion";
      bmsg += "</td>";
      bmsg += "<td " + colStyl + width_td2;
      bmsg += "Detalle";
      bmsg += "</td>";
      bmsg += "</tr>";
      bmsg += "<tr>";
      bmsg += "<td " + rowStyl + width_td1;
      bmsg += "Fecha y Hora";
      bmsg += "</td>";
      bmsg += "<td " + rowStyl + width_td2;
      bmsg += datetime;
      bmsg += "</td>";
      bmsg += "</tr>";
      bmsg += "<tr>";
      bmsg += "<td " + rowStyl + width_td1;
      bmsg += "NetSuite Version (Release)";
      bmsg += "</td>";
      bmsg += "<td " + rowStyl + width_td2;
      bmsg += namevers;
      bmsg += "</td>";
      bmsg += "</tr>";
      bmsg += "<tr>";
      bmsg += "<td " + rowStyl + width_td1;
      bmsg += "Codigo Cliente (Company)";
      bmsg += "</td>";
      bmsg += "<td " + rowStyl + width_td2;
      bmsg += namecomp;
      bmsg += "</td>";
      bmsg += "</tr>";
      bmsg += "<tr>";
      bmsg += "<td " + rowStyl + width_td1;
      bmsg += "Subsidiaria del Usuario (ID)";
      bmsg += "</td>";
      bmsg += "<td " + rowStyl + width_td2;
      bmsg += namesubs;
      bmsg += "</td>";
      bmsg += "</tr>";
      bmsg += "<tr>";
      bmsg += "<td " + rowStyl + width_td1;
      bmsg += "Nombre del Usuario (User) ";
      bmsg += "</td>";
      bmsg += "<td " + rowStyl + width_td2;
      bmsg += nameuser;
      bmsg += "</td>";
      bmsg += "</tr>";
      bmsg += "</table>";

      // Generacion txt y envio de email
      var subject = 'NS - Bundle Latinoamerica - Mensaje.';
      var body = '<body text="#333333" link="#014684" vlink="#014684" alink="#014684">';
      body += '<table width="642" border="0" align="center" cellpadding="0" cellspacing="0">';
      body += '<tr>';
      body += '<td width="100%" valign="top">';
      body += '<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">';
      body += '<tr>';
      body += '<td width="100%" colspan="2"><img style="display: block;" src="https://system.na1.netsuite.com/core/media/media.nl?id=921&c=TSTDRV1038915&h=c493217843d184e7f054" width="645" alt="main banner"/></td>';
      body += '</tr>';
      body += '</table>';
      body += '<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">';
      body += '<tr>';
      body += '<td bgcolor="#d50303" width="15%">&nbsp;</td>';
      body += '<td bgcolor="#d50303" width="85%">';
      body += '<font style="color:#FFFFFF; line-height:130%; font-family:Arial, Helvetica, sans-serif; font-size:19px">';
      body += 'Estimado(a) ' + empfir + ':<br>';
      body += '</font>';
      body += '</td>';
      body += '</tr>';
      body += '<tr>';
      body += '<td width="100%" bgcolor="#d50303" colspan="2" align="right"><a href="http://www.latamready.com/#contac"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=923&c=TSTDRV1038915&h=3c7406d759735a1e791d" width="94" style="margin-right:45px" /></a></td>';
      body += '</tr>';
      body += '<tr>';
      body += '<td width="100%" bgcolor="#FFF" colspan="2" align="right">';
      body += '<a href="https://www.linkedin.com/company/9207808"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=924&c=TSTDRV1038915&h=c135e74bcb8d5e1ac356" width="15" style="margin:5px 1px 5px 0px" /></a>';
      body += '<a href="https://www.facebook.com/LatamReady-337412836443120/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=919&c=TSTDRV1038915&h=9c937774d04fb76747f7" width="15" style="margin:5px 1px 5px 0px" /></a>';
      body += '<a href="https://twitter.com/LatamReady"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=928&c=TSTDRV1038915&h=fc69b39a8e7210c65984" width="15" style="margin:5px 47px 5px 0px" /></a>';
      body += '</td>';
      body += '</tr>';
      body += '</table>';
      body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
      body += '<tr>';
      body += '<td width="15%">&nbsp;</td>';
      body += '<td width="70%">';
      body += '<font style="color:#333333;line-height:200%; font-family:Trebuchet MS, Helvetica, sans-serif; font-size:13px">';
      body += '<p>Este es un mensaje automático de LatamReady SuiteApp.</p>';
      // Depende del parametro envia el mensaje
      if (opc == '' || opc == null) {
        body += '<p>El nombre del archivo generado es: </p>';
        body += '<p><b> - ' + namereport + '</b></p>';
      } else {
        switch (opc) {
          case 2:
            body += '<p>' + msgreport + '</p>';
            break;
          case 3:
            body += '<p>' + msgreport + '</p>';
            body += '<p><b> - ' + namereport + '</b></p>';
            break;
          default:
        }
      }
      body += bmsg;
      body += '<p>Saludos,</p>';
      body += '<p>El Equipo de LatamReady</p>';
      body += '</font>';
      body += '</td>';
      body += '<td width="15%">&nbsp;</td>';
      body += '</tr>';
      body += '</table>';
      body += '<br>';
      body += '<table width="100%" border="0" cellspacing="0" cellpadding="2" bgcolor="#e5e6e7">';
      body += '<tr>';
      body += '<td>&nbsp;</td>';
      body += '</tr>';
      body += '<tr>';
      body += '<td width="15%">&nbsp;</td>';
      body += '<td width="70%" align="center">';
      body += '<font style="color:#333333;line-height:200%; font-family:Trebuchet MS, Helvetica, sans-serif; font-size:12px;" >';
      body += '<i>Este es un mensaje automático. Por favor, no responda este correo electrónico.</i>';
      body += '</font>';
      body += '</td>';
      body += '<td width="15%">&nbsp;</td>';
      body += '</tr>';
      body += '<tr>';
      body += '<td>&nbsp;</td>';
      body += '</tr>';
      body += '</table>';
      body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
      body += '<tr>';
      body += '<td width="15%">&nbsp;</td>';
      body += '<td width="70%" align="center">';
      body += '<a href="http://www.latamready.com/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=926&c=TSTDRV1038915&h=e14f0c301f279780eb38" width="169" style="margin:15px 0px 15px 0px" /></a>';
      body += '</td>';
      body += '<td width="15%">&nbsp;</td>';
      body += '</tr>';
      body += '</table>';
      body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
      body += '<tr>';
      body += '<td width="15%">&nbsp;</td>';
      body += '<td width="70%" align="center">';
      body += '<a href="https://www.linkedin.com/company/9207808"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=925&c=TSTDRV1038915&h=41ec53b63dba135488be" width="101" style="margin:0px 5px 0px 5px" /></a>';
      body += '<a href="https://www.facebook.com/LatamReady-337412836443120/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=920&c=TSTDRV1038915&h=7fb4d03fff9283e55318" width="101" style="margin:0px 5px 0px 5px" /></a>';
      body += '<a href="https://twitter.com/LatamReady"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=929&c=TSTDRV1038915&h=300c376863035d25c42a" width="101" style="margin:0px 5px 0px 5px" /></a>';
      body += '</td>';
      body += '<td width="15%">&nbsp;</td>';
      body += '</tr>';
      body += '</table>';
      body += '<table width="100%" border="0" cellspacing="0">';
      body += '<tr>';
      body += '<td>';
      body += '<img src="https://system.na1.netsuite.com/core/media/media.nl?id=918&c=TSTDRV1038915&h=7f0198f888bdbb495497" width="642" style="margin:15px 0px 15px 0px" /></a>';
      body += '</td>';
      body += '</tr>';
      body += '</table>';
      body += '</td>';
      body += '</tr>';
      body += '</table>';
      body += '</body>';
      var bcc = new Array();
      var cco = new Array();

      // Api de Netsuite para enviar correo electronico
      var ID = runtime.getCurrentUser().id;
      email.send({
        author: ID,
        recipients: empema,
        subject: subject,
        body: body,
        bcc: bcc,
        cco: cco
      });

      return true;
    }

    /* **********************************************************
     * Nota: Envio de mail al usuario en caso de ocurrir error.
     * ********************************************************** */
     function sendemail(err, LMRY_script) {
       try {
         // Mensaje de error
         if (LMRY_script === undefined || LMRY_script == null) {
           LMRY_script = 'LatamReady - Sending Emails Library'
         }
         log.error(LMRY_script, err);

         var LANGUAGE = runtime.getCurrentScript().getParameter({
           name: 'LANGUAGE'
         });
         LANGUAGE = LANGUAGE.substring(0, 2);

         // Dados del runtime.getCurrentUser
         var namevers = runtime.version;
         var namecomp = runtime.accountId;
         var nameuser = runtime.getCurrentUser().name;
         var nameroce = runtime.getCurrentUser().roleCenter;
         var namerole = runtime.getCurrentUser().role;
         var namesubs = runtime.getCurrentUser().subsidiary;

         var typeEnvironment = runtime.envType;
         var executionContext = runtime.executionContext;
         var bundleIds = runtime.getCurrentScript().bundleIds;
         var scriptId = runtime.getCurrentScript().id;

         // Activar solo para QA
         // log.error('record', JSON.stringify(record));

         // Apis de Netsuite
         var nametype = record.type;
         var namerdid = record.id;

         // Verifica si es One World
         var featuresubs = runtime.isFeatureInEffect({
           feature: 'SUBSIDIARIES'
         });

         var permSubsidiary = runtime.getCurrentUser().getPermission('LIST_SUBSIDIARY'); //Permiso para subsidiarias

         if ((featuresubs == true || featuresubs == 'T') && Number(permSubsidiary) > 0) {
           var namesubs = search.lookupFields({
             type: 'subsidiary',
             id: namesubs,
             columns: ['name']
           }).name;
         }

         // Error
         err = '- ' + err;
         // Error por identificar
         if (err.indexOf("object Object") > 0) {
           // No se envia mail
           return true;
         }

         // Verificamos el tipo de error
         if (err.indexOf("RCRD_HAS_BEEN_CHANGED") > 0) {
           return true;
         }

         // Verificamos el tipo de error
         if (err.indexOf("NetworkError: Failed to execute") > 0) {
           // Mensaje al usuario
           err = MSG_TEXT['NETWORK_ERROR'][LANGUAGE] || MSG_TEXT['NETWORK_ERROR']['en'];
         }

         // Verificamos que no sea session terminada
         if (err.indexOf("SESSION_TIMED_OUT") > 0) {
           // Mensaje al usuario
           err = MSG_TEXT['SESSION_TIMEOUT'][LANGUAGE] || MSG_TEXT['SESSION_TIMEOUT']['en'];
         }

         // Datos del Usuario
         var userfn = ['email', 'firstname'];
         var empema = runtime.getCurrentUser().email;
         var empfir = runtime.getCurrentUser().name;
         var userid = runtime.getCurrentUser().id;

         //******************************************************
         // Latam - Send Only Employee Manager (Check Box)
         // Latam - Employee Manager           (Usuario)
         //******************************************************
         var swSendMail = runtime.getCurrentScript().getParameter({
           name: 'custscript_lmry_employee_manager_send'
         });
         var idSendMail = runtime.getCurrentScript().getParameter({
           name: 'custscript_lmry_employee_manager'
         });
         // Ingresa solo si el usuario de System y/o forzar el envio de correo
         if (userid < 0 || swSendMail == true) {
           userid = idSendMail;
           // Internal ID del Usuario
           if (userid) {
             try {
               var employ = search.lookupFields({
                 type: 'employee',
                 id: userid,
                 columns: userfn
               });
               empema = employ.email;
               empfir = employ.firstname;
             } catch (msgerror) {
               log.error('sendemail - userid', msgerror);
               return true;
             }
           }
         }
         // Envio del ID del usuario al log
         if (!empema) {
           log.error('function sendemail ', 'Usuario no tiene correo');
           return true;
         }

         var datetime = new Date();

         var bmsg = '';
         bmsg += "<table style=\"font-family: Courier New, Courier, monospace; width:98%; border: 1px solid #d50303;\">";
         bmsg += "<tr>";
         bmsg += "<td " + colStyl + width_td1;
         bmsg += (MSG_TEXT['DESCRIPTION'][LANGUAGE] || MSG_TEXT['DESCRIPTION']['en']);
         bmsg += "</td>";
         bmsg += "<td " + colStyl + width_td2;
         bmsg += (MSG_TEXT['DETAILS'][LANGUAGE] || MSG_TEXT['DETAILS']['en']);
         bmsg += "</td>";
         bmsg += "</tr>";
         bmsg += "<tr>";
         bmsg += "<td " + rowStyl + width_td1;
         bmsg += (MSG_TEXT['DATE'][LANGUAGE] || MSG_TEXT['DATE']['en']);
         bmsg += "</td>";
         bmsg += "<td " + rowStyl + width_td2;
         bmsg += datetime;
         bmsg += "</td>";
         bmsg += "</tr>";
         //Ambiente
         bmsg += "<tr>";
         bmsg += "<td " + rowStyl + width_td1;
         bmsg += (MSG_TEXT['ENVIRONMENT'][LANGUAGE] || MSG_TEXT['ENVIRONMENT']['en']);
         bmsg += "</td>";
         bmsg += "<td " + rowStyl + width_td2;
         bmsg += typeEnvironment;
         bmsg += "</td>";
         bmsg += "</tr>";

         bmsg += "<tr>";
         bmsg += "<td " + rowStyl + width_td1;
         bmsg += "NetSuite Version (Release)";
         bmsg += "</td>";
         bmsg += "<td " + rowStyl + width_td2;
         bmsg += namevers;
         bmsg += "</td>";
         bmsg += "</tr>";
         bmsg += "<tr>";
         bmsg += "<td " + rowStyl + width_td1;
         bmsg += (MSG_TEXT['CODE_CLIENT'][LANGUAGE] || MSG_TEXT['CODE_CLIENT']['en']);
         bmsg += "</td>";
         bmsg += "<td " + rowStyl + width_td2;
         bmsg += namecomp;
         bmsg += "</td>";
         bmsg += "</tr>";
         bmsg += "<tr>";
         bmsg += "<td " + rowStyl + width_td1;
         bmsg += (MSG_TEXT['SUBSIDIARY'][LANGUAGE] || MSG_TEXT['SUBSIDIARY']['en']);
         bmsg += "</td>";
         bmsg += "<td " + rowStyl + width_td2;
         bmsg += namesubs;
         bmsg += "</td>";
         bmsg += "</tr>";
         bmsg += "<tr>";
         bmsg += "<td " + rowStyl + width_td1;
         bmsg += (MSG_TEXT['NAME_USER'][LANGUAGE] || MSG_TEXT['NAME_USER']['en']);
         bmsg += "</td>";
         bmsg += "<td " + rowStyl + width_td2;
         bmsg += nameuser;
         bmsg += "</td>";
         bmsg += "</tr>";
         // Verifica que este dentro de una transaccion
         if (nametype != '' && nametype != null) {
           bmsg += "<tr>";
           bmsg += "<td " + rowStyl + width_td1;
           bmsg += (MSG_TEXT['TYPE_TRANSACTION'][LANGUAGE] || MSG_TEXT['TYPE_TRANSACTION']['en']);
           bmsg += "</td>";
           bmsg += "<td " + rowStyl + width_td2;
           bmsg += nametype;
           bmsg += "</td>";
           bmsg += "</tr>";
           bmsg += "<tr>";
           bmsg += "<td " + rowStyl + width_td1;
           bmsg += (MSG_TEXT['ID_TRANSACTION'][LANGUAGE] || MSG_TEXT['ID_TRANSACTION']['en']);
           bmsg += "</td>";
           bmsg += "<td " + rowStyl + width_td2;
           bmsg += namerdid;
           bmsg += "</td>";
           bmsg += "</tr>";
         }
         bmsg += "<tr>";
         bmsg += "<td " + rowStyl + width_td1;
         bmsg += (MSG_TEXT['ROL'][LANGUAGE] || MSG_TEXT['ROL']['en']);
         bmsg += "</td>";
         bmsg += "<td " + rowStyl + width_td2;
         bmsg += nameroce;
         bmsg += "</td>";
         bmsg += "</tr>";
         bmsg += "<tr>";
         bmsg += "<td " + rowStyl + width_td1;
         bmsg += (MSG_TEXT['ROL_USER'][LANGUAGE] || MSG_TEXT['ROL_USER']['en']);
         bmsg += "</td>";
         bmsg += "<td " + rowStyl + width_td2;
         bmsg += namerole;
         bmsg += "</td>";
         bmsg += "</tr>";

         //Execution Context
         bmsg += "<tr>";
         bmsg += "<td " + rowStyl + width_td1;
         bmsg += (MSG_TEXT['EXECUTION'][LANGUAGE] || MSG_TEXT['EXECUTION']['en']);
         bmsg += "</td>";
         bmsg += "<td " + rowStyl + width_td2;
         bmsg += executionContext;
         bmsg += "</td>";
         bmsg += "</tr>";

         //Bundle ID
         if (bundleIds && bundleIds.length) {
           bmsg += "<tr>";
           bmsg += "<td " + rowStyl + width_td1;
           bmsg += "Bundle ID";
           bmsg += "</td>";
           bmsg += "<td " + rowStyl + width_td2;
           bmsg += bundleIds + '';
           bmsg += "</td>";
           bmsg += "</tr>";
         }

         //Script ID
         if (scriptId) {
           bmsg += "<tr>";
           bmsg += "<td " + rowStyl + width_td1;
           bmsg += "Script ID";
           bmsg += "</td>";
           bmsg += "<td " + rowStyl + width_td2;
           bmsg += scriptId;
           bmsg += "</td>";
           bmsg += "</tr>";
         }

         bmsg += "<tr>";
         bmsg += "<td " + rowStyl + width_td1;
         bmsg += 'Script ' + LMRY_script + '';
         bmsg += "</td>";
         bmsg += "<td " + errStyl + width_td2;
         // Inicio - Detallar el error producido
         var errdecrip = err;
         var posExist1 = errdecrip.indexOf('type');
         var posExist2 = errdecrip.indexOf('message');
         var posExist3 = errdecrip.indexOf('ReferenceError');
         log.error('type , message :' + posExist1 + ' , ' + posExist2, 'ReferenceError : ' + posExist3)
         if ((parseInt(posExist1) > 0 && parseInt(posExist2) > 0) || parseInt(posExist3) > 0) {
           bmsg += '<table>';
           bmsg += '<tr>';
           bmsg += '<td>';
           bmsg += 'Type';
           bmsg += '</td>';
           bmsg += '<td>';
           bmsg += ':';
           bmsg += '</td>';
           bmsg += '<td>';
           bmsg += Latam_Get_Result(errdecrip, '"type"');
           bmsg += '</td>';
           bmsg += '</tr>';
           var msgcode = Latam_Get_Result(errdecrip, '"code"');
           if (msgcode != '' && msgcode != null && msgcode != undefined) {
             bmsg += '<tr>';
             bmsg += '<td>';
             bmsg += 'Code';
             bmsg += '</td>';
             bmsg += '<td>';
             bmsg += ':';
             bmsg += '</td>';
             bmsg += '<td>';
             bmsg += msgcode;
             bmsg += '</td>';
             bmsg += '</tr>';
           }
           bmsg += '<tr>';
           bmsg += '<td>';
           bmsg += 'Message';
           bmsg += '</td>';
           bmsg += '<td>';
           bmsg += ':';
           bmsg += '</td>';
           bmsg += '<td>';
           bmsg += Latam_Get_Result(errdecrip, '"message"');
           bmsg += '</td>';
           bmsg += '</tr>';
           var msgusev = Latam_Get_Result(errdecrip, '"userEvent"');
           if (msgusev != '' && msgusev != null && msgusev != undefined) {
             bmsg += '<tr>';
             bmsg += '<td>';
             bmsg += 'User Event:';
             bmsg += '</td>';
             bmsg += '<td>';
             bmsg += ':';
             bmsg += '</td>';
             bmsg += '<td>';
             bmsg += msgusev;
             bmsg += '</td>';
             bmsg += '</tr>';
           }
           bmsg += '</table>';
         } else {
           bmsg += errdecrip;
         }
         // Fin - Detallar el error producido
         bmsg += "</td>";
         bmsg += "</tr>";
         bmsg += "</table>";

         // Envio de email
         var subject = 'NS - Bundle Latinoamerica - User Error';
         var body = '<body text="#333333" link="#014684" vlink="#014684" alink="#014684">';
         body += '<table width="642" border="0" align="center" cellpadding="0" cellspacing="0">';
         body += '<tr>';
         body += '<td width="100%" valign="top">';
         body += '<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">';
         body += '<tr>';
         body += '<td width="100%" colspan="2"><img style="display: block;" src="https://system.na1.netsuite.com/core/media/media.nl?id=921&c=TSTDRV1038915&h=c493217843d184e7f054" width="645" alt="main banner"/></td>';
         body += '</tr>';
         body += '</table>';
         body += '<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">';
         body += '<tr>';
         body += '<td bgcolor="#d50303" width="15%">&nbsp;</td>';
         body += '<td bgcolor="#d50303" width="85%">';
         body += '<font style="color:#FFFFFF; line-height:130%; font-family:Arial, Helvetica, sans-serif; font-size:19px">';
         body += (MSG_TEXT['SALUTATION'][LANGUAGE] || MSG_TEXT['SALUTATION']['en']) + empfir + ':<br>';
         body += '</font>';
         body += '</td>';
         body += '</tr>';
         body += '<tr>';
         body += '<td width="100%" bgcolor="#d50303" colspan="2" align="right"><a href="http://www.latamready.com/#contac"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=923&c=TSTDRV1038915&h=3c7406d759735a1e791d" width="94" style="margin-right:45px" /></a></td>';
         body += '</tr>';
         body += '<tr>';
         body += '<td width="100%" bgcolor="#FFF" colspan="2" align="right">';
         body += '<a href="https://www.linkedin.com/company/9207808"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=924&c=TSTDRV1038915&h=c135e74bcb8d5e1ac356" width="15" style="margin:5px 1px 5px 0px" /></a>';
         body += '<a href="https://www.facebook.com/LatamReady-337412836443120/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=919&c=TSTDRV1038915&h=9c937774d04fb76747f7" width="15" style="margin:5px 1px 5px 0px" /></a>';
         body += '<a href="https://twitter.com/LatamReady"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=928&c=TSTDRV1038915&h=fc69b39a8e7210c65984" width="15" style="margin:5px 47px 5px 0px" /></a>';
         body += '</td>';
         body += '</tr>';
         body += '</table>';
         body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
         body += '<tr>';
         body += '<td width="15%">&nbsp;</td>';
         body += '<td width="70%">';
         body += '<font style="color:#333333;line-height:200%; font-family:Trebuchet MS, Helvetica, sans-serif; font-size:13px">';
         body += (MSG_TEXT['SUBJECT_ERROR'][LANGUAGE] || MSG_TEXT['SUBJECT_ERROR']['en']);
         body += bmsg;
         body += (MSG_TEXT['BODY_ERROR'][LANGUAGE] || MSG_TEXT['BODY_ERROR']['en']);
         body += '</font>';
         body += '</td>';
         body += '<td width="15%">&nbsp;</td>';
         body += '</tr>';
         body += '</table>';
         body += '<br>';
         body += '<table width="100%" border="0" cellspacing="0" cellpadding="2" bgcolor="#e5e6e7">';
         body += '<tr>';
         body += '<td>&nbsp;</td>';
         body += '</tr>';
         body += '<tr>';
         body += '<td width="15%">&nbsp;</td>';
         body += '<td width="70%" align="center">';
         body += '<font style="color:#333333;line-height:200%; font-family:Trebuchet MS, Helvetica, sans-serif; font-size:12px;" >';
         body += (MSG_TEXT['END_ERROR'][LANGUAGE] || MSG_TEXT['END_ERROR']['en']);
         body += '</font>';
         body += '</td>';
         body += '<td width="15%">&nbsp;</td>';
         body += '</tr>';
         body += '<tr>';
         body += '<td>&nbsp;</td>';
         body += '</tr>';
         body += '</table>';
         body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
         body += '<tr>';
         body += '<td width="15%">&nbsp;</td>';
         body += '<td width="70%" align="center">';
         body += '<a href="http://www.latamready.com/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=926&c=TSTDRV1038915&h=e14f0c301f279780eb38" width="169" style="margin:15px 0px 15px 0px" /></a>';
         body += '</td>';
         body += '<td width="15%">&nbsp;</td>';
         body += '</tr>';
         body += '</table>';
         body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
         body += '<tr>';
         body += '<td width="15%">&nbsp;</td>';
         body += '<td width="70%" align="center">';
         body += '<a href="https://www.linkedin.com/company/9207808"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=925&c=TSTDRV1038915&h=41ec53b63dba135488be" width="101" style="margin:0px 5px 0px 5px" /></a>';
         body += '<a href="https://www.facebook.com/LatamReady-337412836443120/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=920&c=TSTDRV1038915&h=7fb4d03fff9283e55318" width="101" style="margin:0px 5px 0px 5px" /></a>';
         body += '<a href="https://twitter.com/LatamReady"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=929&c=TSTDRV1038915&h=300c376863035d25c42a" width="101" style="margin:0px 5px 0px 5px" /></a>';
         body += '</td>';
         body += '<td width="15%">&nbsp;</td>';
         body += '</tr>';
         body += '</table>';
         body += '<table width="100%" border="0" cellspacing="0">';
         body += '<tr>';
         body += '<td>';
         body += '<img src="https://system.na1.netsuite.com/core/media/media.nl?id=918&c=TSTDRV1038915&h=7f0198f888bdbb495497" width="642" style="margin:15px 0px 15px 0px" /></a>';
         body += '</td>';
         body += '</tr>';
         body += '</table>';
         body += '</td>';
         body += '</tr>';
         body += '</table>';
         body += '</body>';
         var bcc = new Array();
         var cco = new Array();
         cco[0] = 'customer.voice@latamready.com';

         // Datos del Usuario
         strDatos = "UserID: " + userid + " , ";
         strDatos += "empfir: " + empfir + " , ";
         strDatos += "empema: " + empema;

         log.error('[ sendemail : ' + LMRY_script + ']', strDatos);

         // Api de Netsuite para enviar correo electronico
         email.send({
           author: userid,
           recipients: empema,
           subject: subject,
           body: body,
           bcc: bcc,
           cco: cco
         });

       } catch (err) {
         log.error(' [ sendemail ] ' + err, LMRY_script);
       }
       return true;
     }

     /* **********************************************************
      * Nota: Envio de mejora mail2 al usuario en caso de ocurrir error.
      * ********************************************************** */
      function sendemail2(err, LMRY_script, currentRCD, identificador, entidad) {
        try {
          // Mensaje de error
          if (LMRY_script === undefined || LMRY_script == null) {
            LMRY_script = 'LatamReady - Sending Emails Library'
          }
          var LANGUAGE = runtime.getCurrentScript().getParameter({
            name: 'LANGUAGE'
          });
          LANGUAGE = LANGUAGE.substring(0, 2);

          log.error(LMRY_script, err);

          // Dados del runtime.getCurrentUser
          var namevers = runtime.version;
          var namecomp = runtime.accountId;
          var nameuser = runtime.getCurrentUser().name;
          var nameroce = runtime.getCurrentUser().roleCenter;
          var namerole = runtime.getCurrentUser().role;
          var namesubs = runtime.getCurrentUser().subsidiary;
          var typeEnvironment = runtime.envType;
          var executionContext = runtime.executionContext;
          var bundleIds = runtime.getCurrentScript().bundleIds;
          var scriptId = runtime.getCurrentScript().id;

          // Apis de Netsuite
          var nametype = currentRCD.type;
          var namerdid = currentRCD.id;
          var tranid = currentRCD.getValue(identificador);
          var entity = currentRCD.getValue(entidad);

          // Verifica si es One World
          var featuresubs = runtime.isFeatureInEffect({
            feature: 'SUBSIDIARIES'
          });

          var permSubsidiary = runtime.getCurrentUser().getPermission('LIST_SUBSIDIARY'); //Permiso para subsidiarias

          if ((featuresubs == true || featuresubs == 'T') && Number(permSubsidiary) > 0) {
            var namesubs = search.lookupFields({
              type: 'subsidiary',
              id: namesubs,
              columns: ['name']
            }).name;
          }

          err = '- ' + err;
          // Error por identificar
          if (err.indexOf("object Object") > 0) {
            // No se envia mail
            return true;
          }

          // Verificamos el tipo de error
          if (err.indexOf("RCRD_HAS_BEEN_CHANGED") > 0) {
            return true;
          }

          // Verificamos el tipo de error
          if (err.indexOf("NetworkError: Failed to execute") > 0) {
            // Mensaje al usuario
            err = MSG_TEXT['NETWORK_ERROR'][LANGUAGE] || MSG_TEXT['NETWORK_ERROR']['en'];
          }

          // Verificamos que no sea session terminada
          if (err.indexOf("SESSION_TIMED_OUT") > 0) {
            // Mensaje al usuario
            err = MSG_TEXT['SESSION_TIMEOUT'][LANGUAGE] || MSG_TEXT['SESSION_TIMEOUT']['en'];
          }

          // Datos del Usuario
          var userfn = ['email', 'firstname'];
          var empema = runtime.getCurrentUser().email;
          var empfir = runtime.getCurrentUser().name;
          var userid = runtime.getCurrentUser().id;

          //******************************************************
          // Latam - Send Only Employee Manager (Check Box)
          // Latam - Employee Manager           (Usuario)
          //******************************************************
          var swSendMail = runtime.getCurrentScript().getParameter({
            name: 'custscript_lmry_employee_manager_send'
          });
          var idSendMail = runtime.getCurrentScript().getParameter({
            name: 'custscript_lmry_employee_manager'
          });
          // Ingresa solo si el usuario de System y/o forzar el envio de correo
          if (userid < 0 || swSendMail == true) {
            userid = idSendMail;
            // Internal ID del Usuario
            if (userid) {
              try {
                var employ = search.lookupFields({
                  type: 'employee',
                  id: userid,
                  columns: userfn
                });
                empema = employ.email;
                empfir = employ.firstname;
              } catch (msgerror) {
                log.error('sendemail2 - userid', msgerror);
                return true;
              }
            }
          }
          // Envio del ID del usuario al log
          if (!empema) {
            log.error('function sendemail2 ', 'Usuario no tiene correo');
            return true;
          }

          var datetime = new Date();

          var bmsg = '';
          bmsg += "<table style=\"font-family: Courier New, Courier, monospace; width:98%; border: 1px solid #d50303;\">";
          bmsg += "<tr>";
          bmsg += "<td " + colStyl + width_td1;
          bmsg += (MSG_TEXT['DESCRIPTION'][LANGUAGE] || MSG_TEXT['DESCRIPTION']['en']);
          bmsg += "</td>";
          bmsg += "<td " + colStyl + width_td2;
          bmsg += (MSG_TEXT['DETAILS'][LANGUAGE] || MSG_TEXT['DETAILS']['en']);
          bmsg += "</td>";
          bmsg += "</tr>";
          bmsg += "<tr>";
          bmsg += "<td " + rowStyl + width_td1;
          bmsg += (MSG_TEXT['DATE'][LANGUAGE] || MSG_TEXT['DATE']['en']);
          bmsg += "</td>";
          bmsg += "<td " + rowStyl + width_td2;
          bmsg += datetime;
          bmsg += "</td>";
          bmsg += "</tr>";
          //Ambiente
          bmsg += "<tr>";
          bmsg += "<td " + rowStyl + width_td1;
          bmsg += (MSG_TEXT['ENVIRONMENT'][LANGUAGE] || MSG_TEXT['ENVIRONMENT']['en']);
          bmsg += "</td>";
          bmsg += "<td " + rowStyl + width_td2;
          bmsg += typeEnvironment;
          bmsg += "</td>";
          bmsg += "</tr>";

          bmsg += "<tr>";
          bmsg += "<td " + rowStyl + width_td1;
          bmsg += "NetSuite Version (Release)";
          bmsg += "</td>";
          bmsg += "<td " + rowStyl + width_td2;
          bmsg += namevers;
          bmsg += "</td>";
          bmsg += "</tr>";
          bmsg += "<tr>";
          bmsg += "<td " + rowStyl + width_td1;
          bmsg += (MSG_TEXT['CODE_CLIENT'][LANGUAGE] || MSG_TEXT['CODE_CLIENT']['en']);
          bmsg += "</td>";
          bmsg += "<td " + rowStyl + width_td2;
          bmsg += namecomp;
          bmsg += "</td>";
          bmsg += "</tr>";
          bmsg += "<tr>";
          bmsg += "<td " + rowStyl + width_td1;
          bmsg += (MSG_TEXT['SUBSIDIARY'][LANGUAGE] || MSG_TEXT['SUBSIDIARY']['en']);
          bmsg += "</td>";
          bmsg += "<td " + rowStyl + width_td2;
          bmsg += namesubs;
          bmsg += "</td>";
          bmsg += "</tr>";
          bmsg += "<tr>";
          bmsg += "<td " + rowStyl + width_td1;
          bmsg += (MSG_TEXT['NAME_USER'][LANGUAGE] || MSG_TEXT['NAME_USER']['en']);
          bmsg += "</td>";
          bmsg += "<td " + rowStyl + width_td2;
          bmsg += nameuser;
          bmsg += "</td>";
          bmsg += "</tr>";
          // Verifica que este dentro de una transaccion
          if (nametype != '' && nametype != null && nametype != undefined) {
            bmsg += "<tr>";
            bmsg += "<td " + rowStyl + width_td1;
            bmsg += (MSG_TEXT['TYPE_TRANSACTION'][LANGUAGE] || MSG_TEXT['TYPE_TRANSACTION']['en']);
            bmsg += "</td>";
            bmsg += "<td " + rowStyl + width_td2;
            bmsg += nametype;
            bmsg += "</td>";
            bmsg += "</tr>";
            if (namerdid != '' && namerdid != null && namerdid != undefined) {
              bmsg += "<tr>";
              bmsg += "<td " + rowStyl + width_td1;
              bmsg += (MSG_TEXT['ID_TRANSACTION'][LANGUAGE] || MSG_TEXT['ID_TRANSACTION']['en']);
              bmsg += "</td>";
              bmsg += "<td " + rowStyl + width_td2;
              bmsg += namerdid;
              bmsg += "</td>";
              bmsg += "</tr>";
            }
            if (tranid != '' && tranid != null && tranid != undefined) {
              bmsg += "<tr>";
              bmsg += "<td " + rowStyl + width_td1;
              bmsg += (MSG_TEXT['TRANID'][LANGUAGE] || MSG_TEXT['TRANID']['en']);
              bmsg += "</td>";
              bmsg += "<td " + rowStyl + width_td2;
              bmsg += entity + '<br>' + tranid;
              bmsg += "</td>";
              bmsg += "</tr>";
            }
          }
          bmsg += "<tr>";
          bmsg += "<td " + rowStyl + width_td1;
          bmsg += (MSG_TEXT['ROL'][LANGUAGE] || MSG_TEXT['ROL']['en']);
          bmsg += "</td>";
          bmsg += "<td " + rowStyl + width_td2;
          bmsg += nameroce;
          bmsg += "</td>";
          bmsg += "</tr>";
          bmsg += "<tr>";
          bmsg += "<td " + rowStyl + width_td1;
          bmsg += (MSG_TEXT['ROL_USER'][LANGUAGE] || MSG_TEXT['ROL_USER']['en']);
          bmsg += "</td>";
          bmsg += "<td " + rowStyl + width_td2;
          bmsg += namerole;
          bmsg += "</td>";
          bmsg += "</tr>";

          //Execution Context
          bmsg += "<tr>";
          bmsg += "<td " + rowStyl + width_td1;
          bmsg += (MSG_TEXT['EXECUTION'][LANGUAGE] || MSG_TEXT['EXECUTION']['en']);
          bmsg += "</td>";
          bmsg += "<td " + rowStyl + width_td2;
          bmsg += executionContext;
          bmsg += "</td>";
          bmsg += "</tr>";

          //Bundle ID
          if (bundleIds && bundleIds.length) {
            bmsg += "<tr>";
            bmsg += "<td " + rowStyl + width_td1;
            bmsg += "Bundle ID";
            bmsg += "</td>";
            bmsg += "<td " + rowStyl + width_td2;
            bmsg += bundleIds + '';
            bmsg += "</td>";
            bmsg += "</tr>";
          }

          //Script ID
          if (scriptId) {
            bmsg += "<tr>";
            bmsg += "<td " + rowStyl + width_td1;
            bmsg += "Script ID";
            bmsg += "</td>";
            bmsg += "<td " + rowStyl + width_td2;
            bmsg += scriptId;
            bmsg += "</td>";
            bmsg += "</tr>";
          }

          bmsg += "<tr>";
          bmsg += "<td " + rowStyl + width_td1;
          bmsg += 'Script ' + LMRY_script + '';
          bmsg += "</td>";
          bmsg += "<td " + errStyl + width_td2;
          // Inicio - Detallar el error producido
          var errdecrip = err;
          var posExist1 = errdecrip.indexOf('type');
          var posExist2 = errdecrip.indexOf('message');
          var posExist3 = errdecrip.indexOf('ReferenceError');
          log.error('type , message :' + posExist1 + ' , ' + posExist2, 'ReferenceError : ' + posExist3)
          if ((parseInt(posExist1) > 0 && parseInt(posExist2) > 0) || parseInt(posExist3) > 0) {
            bmsg += '<table>';
            bmsg += '<tr>';
            bmsg += '<td>';
            bmsg += 'Type';
            bmsg += '</td>';
            bmsg += '<td>';
            bmsg += ':';
            bmsg += '</td>';
            bmsg += '<td>';
            bmsg += Latam_Get_Result(errdecrip, '"type"');
            bmsg += '</td>';
            bmsg += '</tr>';
            var msgcode = Latam_Get_Result(errdecrip, '"code"');
            if (msgcode != '' && msgcode != null && msgcode != undefined) {
              bmsg += '<tr>';
              bmsg += '<td>';
              bmsg += 'Code';
              bmsg += '</td>';
              bmsg += '<td>';
              bmsg += ':';
              bmsg += '</td>';
              bmsg += '<td>';
              bmsg += msgcode;
              bmsg += '</td>';
              bmsg += '</tr>';
            }
            bmsg += '<tr>';
            bmsg += '<td>';
            bmsg += 'Message';
            bmsg += '</td>';
            bmsg += '<td>';
            bmsg += ':';
            bmsg += '</td>';
            bmsg += '<td>';
            bmsg += Latam_Get_Result(errdecrip, '"message"');
            bmsg += '</td>';
            bmsg += '</tr>';
            var msgusev = Latam_Get_Result(errdecrip, '"userEvent"');
            if (msgusev != '' && msgusev != null && msgusev != undefined) {
              bmsg += '<tr>';
              bmsg += '<td>';
              bmsg += 'User Event:';
              bmsg += '</td>';
              bmsg += '<td>';
              bmsg += ':';
              bmsg += '</td>';
              bmsg += '<td>';
              bmsg += msgusev;
              bmsg += '</td>';
              bmsg += '</tr>';
            }
            bmsg += '</table>';
          } else {
            bmsg += errdecrip;
          }
          // Fin - Detallar el error producido
          bmsg += "</td>";
          bmsg += "</tr>";
          bmsg += "</table>";


          // Envio de email
          var subject = 'NS - Bundle Latinoamerica - User Error';
          var body = '<body text="#333333" link="#014684" vlink="#014684" alink="#014684">';
          body += '<table width="642" border="0" align="center" cellpadding="0" cellspacing="0">';
          body += '<tr>';
          body += '<td width="100%" valign="top">';
          body += '<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">';
          body += '<tr>';
          body += '<td width="100%" colspan="2"><img style="display: block;" src="https://system.na1.netsuite.com/core/media/media.nl?id=921&c=TSTDRV1038915&h=c493217843d184e7f054" width="645" alt="main banner"/></td>';
          body += '</tr>';
          body += '</table>';
          body += '<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">';
          body += '<tr>';
          body += '<td bgcolor="#d50303" width="15%">&nbsp;</td>';
          body += '<td bgcolor="#d50303" width="85%">';
          body += '<font style="color:#FFFFFF; line-height:130%; font-family:Arial, Helvetica, sans-serif; font-size:19px">';
          body += (MSG_TEXT['SALUTATION'][LANGUAGE] || MSG_TEXT['SALUTATION']['en']) + empfir + ':<br>';
          body += '</font>';
          body += '</td>';
          body += '</tr>';
          body += '<tr>';
          body += '<td width="100%" bgcolor="#d50303" colspan="2" align="right"><a href="http://www.latamready.com/#contac"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=923&c=TSTDRV1038915&h=3c7406d759735a1e791d" width="94" style="margin-right:45px" /></a></td>';
          body += '</tr>';
          body += '<tr>';
          body += '<td width="100%" bgcolor="#FFF" colspan="2" align="right">';
          body += '<a href="https://www.linkedin.com/company/9207808"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=924&c=TSTDRV1038915&h=c135e74bcb8d5e1ac356" width="15" style="margin:5px 1px 5px 0px" /></a>';
          body += '<a href="https://www.facebook.com/LatamReady-337412836443120/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=919&c=TSTDRV1038915&h=9c937774d04fb76747f7" width="15" style="margin:5px 1px 5px 0px" /></a>';
          body += '<a href="https://twitter.com/LatamReady"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=928&c=TSTDRV1038915&h=fc69b39a8e7210c65984" width="15" style="margin:5px 47px 5px 0px" /></a>';
          body += '</td>';
          body += '</tr>';
          body += '</table>';
          body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
          body += '<tr>';
          body += '<td width="15%">&nbsp;</td>';
          body += '<td width="70%">';
          body += '<font style="color:#333333;line-height:200%; font-family:Trebuchet MS, Helvetica, sans-serif; font-size:13px">';
          body += (MSG_TEXT['SUBJECT_ERROR'][LANGUAGE] || MSG_TEXT['SUBJECT_ERROR']['en']);
          body += bmsg;
          body += (MSG_TEXT['BODY_ERROR'][LANGUAGE] || MSG_TEXT['BODY_ERROR']['en']);
          body += '</font>';
          body += '</td>';
          body += '<td width="15%">&nbsp;</td>';
          body += '</tr>';
          body += '</table>';
          body += '<br>';
          body += '<table width="100%" border="0" cellspacing="0" cellpadding="2" bgcolor="#e5e6e7">';
          body += '<tr>';
          body += '<td>&nbsp;</td>';
          body += '</tr>';
          body += '<tr>';
          body += '<td width="15%">&nbsp;</td>';
          body += '<td width="70%" align="center">';
          body += '<font style="color:#333333;line-height:200%; font-family:Trebuchet MS, Helvetica, sans-serif; font-size:12px;" >';
          body += (MSG_TEXT['END_ERROR'][LANGUAGE] || MSG_TEXT['END_ERROR']['en']);
          body += '</font>';
          body += '</td>';
          body += '<td width="15%">&nbsp;</td>';
          body += '</tr>';
          body += '<tr>';
          body += '<td>&nbsp;</td>';
          body += '</tr>';
          body += '</table>';
          body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
          body += '<tr>';
          body += '<td width="15%">&nbsp;</td>';
          body += '<td width="70%" align="center">';
          body += '<a href="http://www.latamready.com/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=926&c=TSTDRV1038915&h=e14f0c301f279780eb38" width="169" style="margin:15px 0px 15px 0px" /></a>';
          body += '</td>';
          body += '<td width="15%">&nbsp;</td>';
          body += '</tr>';
          body += '</table>';
          body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
          body += '<tr>';
          body += '<td width="15%">&nbsp;</td>';
          body += '<td width="70%" align="center">';
          body += '<a href="https://www.linkedin.com/company/9207808"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=925&c=TSTDRV1038915&h=41ec53b63dba135488be" width="101" style="margin:0px 5px 0px 5px" /></a>';
          body += '<a href="https://www.facebook.com/LatamReady-337412836443120/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=920&c=TSTDRV1038915&h=7fb4d03fff9283e55318" width="101" style="margin:0px 5px 0px 5px" /></a>';
          body += '<a href="https://twitter.com/LatamReady"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=929&c=TSTDRV1038915&h=300c376863035d25c42a" width="101" style="margin:0px 5px 0px 5px" /></a>';
          body += '</td>';
          body += '<td width="15%">&nbsp;</td>';
          body += '</tr>';
          body += '</table>';
          body += '<table width="100%" border="0" cellspacing="0">';
          body += '<tr>';
          body += '<td>';
          body += '<img src="https://system.na1.netsuite.com/core/media/media.nl?id=918&c=TSTDRV1038915&h=7f0198f888bdbb495497" width="642" style="margin:15px 0px 15px 0px" /></a>';
          body += '</td>';
          body += '</tr>';
          body += '</table>';
          body += '</td>';
          body += '</tr>';
          body += '</table>';
          body += '</body>';
          var bcc = new Array();
          var cco = new Array();
          cco[0] = 'customer.voice@latamready.com';

          // Datos del Usuario
          strDatos = "UserID: " + userid + " , ";
          strDatos += "empfir: " + empfir + " , ";
          strDatos += "empema: " + empema;

          log.error('[ sendemail : ' + LMRY_script + ']', strDatos);

          // Api de Netsuite para enviar correo electronico
          email.send({
            author: userid,
            recipients: empema,
            subject: subject,
            body: body,
            bcc: bcc,
            cco: cco
          });

        } catch (err) {
          log.error(' [ sendemail2 ] ' + LMRY_script, err);
        }
        return true;
      }

    function suitelet_get_country(sub, opt, cty, licenses) {

      //var runtimeRT = runtime.getCurrentScript();

      var strdata = '';
      var country = new Array();
      country[0] = '';
      country[1] = '';

      var subsidiari = sub;
      var sub_option = opt;
      var sub_countr = cty;

      // Verifica si es One World
      // var featuresubs = nlapiGetContext().getFeature('SUBSIDIARIES');
      // 1.0
      var featuresubs = runtime.isFeatureInEffect({
        feature: 'SUBSIDIARIES'
      });

      if (sub_option == '' || sub_option == null) {
        if (featuresubs == true || featuresubs == 'T') {
          if (subsidiari != '' && subsidiari != null) {
            var filters = new Array();

            filters[0] = search.createFilter({
              name: 'internalid',
              operator: search.Operator.ANYOF,
              values: [subsidiari]
            });
            var columns = new Array();
            // columns[0] = new nlobjSearchColumn('country');
            // 1.0
            columns[0] = search.createColumn({
              name: 'country'
            });

            var getfields = search.create({
              type: 'subsidiary',
              columns: columns,
              filters: filters
            });
            getfields = getfields.run().getRange(0, 1000);

            if (getfields != '' && getfields != null) {
              country[0] = getfields[0].getValue('country');
              country[1] = getfields[0].getText('country');
            }
          }
        } else {
          country[0] = runtimeRT.getCurrentScript().getParameter({
            name: 'custscript_lmry_country_code_stlt'
          });
          country[1] = runtimeRT.getCurrentScript().getParameter({
            name: 'custscript_lmry_country_desc_stlt'
          });
        }

        // Cadena de respuesta
        strdata += 'Country Cod=' + country[0];
        strdata += ',Country Des=' + country[1];
      } else {
        // Solo para Paraguay
        if (sub_countr == 'PY' && sub_option != '' && sub_option != null) {
          var swprefix = false;
          if (sub_option == 'INV') {
            swprefix = library1.getAuthorization(62, licenses);
          }
          if (sub_option == 'ISP') {
            swprefix = library1.getAuthorization(63, licenses);
          }
          if (sub_option == 'CDM') {
            swprefix = library1.getAuthorization(64, licenses);
          }
          if (swprefix == true && featuresubs == true || featuresubs == 'T') {
            strdata = search.lookupFields({
              type: 'subsidiary',
              id: subsidiari,
              columns: ['tranprefix']
            });

          } else {
            strdata = '';
          }
        } else {
          if (featuresubs == true || featuresubs == 'T') {
            strdata = search.lookupFields({
              type: 'subsidiary',
              id: subsidiari,
              columns: ['tranprefix']
            });

          } else {
            strdata = ' ';
          }
        }
      }
      return strdata;
    }



    /* ----------------------------------------------------------------------------------------------------
     * Extrae los valores obtenidos del arreglo
     * como se muestra a continuacion.
     * Ejemplo:
     * 			array[0]="Nombre Campo":"Valor"
     *  		field = "Nombre Campo"
     *  		strdata = array[0]
     * --------------------------------------------------------------------------------------------------- */
    function Latam_Get_Result(strdata, field) {
      var intpos = strdata.indexOf(field);
      var straux = strdata.substr(parseInt(intpos) + parseInt(field.length) + 1);
      var auxpos = straux.indexOf('",');
      var strcad = '';
      if (intpos > 0) {
        // Extrae la cadena hasta desde (",)
        straux = straux.substr(0, auxpos + 1);
        // Valida que el campo no de null
        if (straux == 'null' || straux == '') {
          return '';
        }
        return straux;
      }
    }

    /* ------------------------------------------------------------------------------------------------------
     * Imprime alertas en la pagina y las deja ahi. Para el ultimo paso de la secuencia
     * @param message
     * @param alert (true = muestra un icono de alerta, false = muestra en icono de confirmacion)
     * --------------------------------------------------------------------------------------------------- */

    function show_on_screen_alert(message, alert) {
      try {
        // Removing a specified element when knowing its parent node
        /*		var element = document.getElementById("lmry_div_alert_1");
            if (element!='' && element!=null){
              while (element.firstChild) {
                  element.removeChild(element.firstChild);
                }
            }
            var element = document.getElementById("lmry_div_alert_2");
            if (element!='' && element!=null){
              while (element.firstChild) {
                  element.removeChild(element.firstChild);
                }
            }
        */
        // Mensaje dentro de la pantalla de Netsuite
        if (alert) {
          jQuery('<div id="lmry_div_alert_1">' +
            '<div class="uir-alert-box warning conflictwarningdivdomid" width="undefined" style="">' +
            '<div class="icon warning"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=576&c=TSTDRV1038915&h=afcac1eba8e3bbfc630e" alt="">' +
            '</div><div class="content">' +
            '<div class="title">LatamReady - Alerta:</div>' +
            '<div class="descr">' + message + '</div></div></div></div>').insertBefore('#div__title');

        } else {
          jQuery('<div id="lmry_div_alert_2">' +
            '<div class="uir-alert-box confirmation session_confirmation_alert" width="100%" style="">' +
            '<div class="icon confirmation"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=577&c=TSTDRV1038915&h=6fd5d72b69abf93869ab" alt="">' +
            '</div><div class="content"><div class="title">LatamReady - Mensaje:</div>' +
            '<div class="descr">' + message + '</div></div></div></div>').insertBefore('#div__title');
        }
      } catch (err) {
        sendemail(' [ show_on_screen_alert ] ' + err, LMRY_script);
      }
    }

    function traductorText(cadena, idiomaTarget, idiomaSource) {
      try {
        const url = "https://libretranslate.com/translate";

        //Traduce textos
        var wsResponse = https.post({
        url: url,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "q": cadena ,
          "source": idiomaSource ,
          "target": idiomaTarget
        })
        });
        log.error('Traducción', JSON.parse(wsResponse.body));

        return JSON.parse(wsResponse.body).translatedText;

      } catch (err) {
        sendemail(' [ traductorText ] ' + err, LMRY_script);
      }
    }

    function acortadorDeLink(WS_URL,urlBoletoBancarioPdf, account) {
      try {

        //Acorta URL del pdf del boleto bancario
        var wsResponse = https.post({
          url: WS_URL,
          body: JSON.stringify({
            "url": urlBoletoBancarioPdf
          }),
          headers: {
            "lmry-account": account,
            "lmry-action": "shortUrlService",
            "Content-Type": "application/json"
          }
        });
        return JSON.parse(wsResponse.body).content;

      } catch (err) {
        sendemail(' [ acortadorDeLink ] ' + err, LMRY_script);
      }
    }

    return {

      onViewColumn: onViewColumn,
      onFieldsHide: onFieldsHide,
      onFieldsDisplay: onFieldsDisplay,
      onFieldsDisplayE: onFieldsDisplayE,
      onFieldsDisplayBody: onFieldsDisplayBody,
      onFieldsDisplayParent: onFieldsDisplayParent,
      onFieldsDisplayParent2: onFieldsDisplayParent2,
      ParentNuevo: ParentNuevo,
      onFieldsDisplayS: onFieldsDisplayS,
      Get_Country_STLT: Get_Country_STLT,
      Validate_Permission: Validate_Permission,
      Validate_Country: Validate_Country,
      getCountryOfAccess: getCountryOfAccess,
      getAuthorization: getAuthorization,
      getHideView: getHideView,
      disableField: disableField,
      getLicenses: getLicenses,
      getLicensesMultiSubsi: getLicensesMultiSubsi,
      getAllLicenses: getAllLicenses,
      _GetResult: _GetResult,
      DeleteChar: DeleteChar,
      onHiddenColumn: onHiddenColumn,
      onShowColumn: onShowColumn,
      sendrptuser: sendrptuser,
      sendemail: sendemail,
      sendemail2: sendemail2,
      show_on_screen_alert: show_on_screen_alert,
      suitelet_get_country: suitelet_get_country,
      getmatchfe: getmatchfe,
      autoline: autoline,
      setline: setline,
      acortadorDeLink:acortadorDeLink,
      traductorText: traductorText
    };
  });
